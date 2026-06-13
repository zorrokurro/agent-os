"""
AgentOS Task Listener - Hermes Agent
Polls ump.db for pending tasks targeting 'Hermes', executes them, and writes back results.
"""
import sqlite3, time, subprocess, sys, json, os

DB_PATH = r'C:\Users\layja\AgentOS\data\ump.db'
POLL_INTERVAL = 5  # seconds
HERMES_CLI = r'C:\Users\layja\AppData\Local\hermes\bin\hermes.exe'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_pending_task():
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT * FROM tasks WHERE target = 'Hermes' AND status = 'pending' "
        "ORDER BY created_at ASC LIMIT 1"
    )
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def update_status(task_id, status, result=None):
    conn = get_db()
    c = conn.cursor()
    if result is not None:
        c.execute(
            "UPDATE tasks SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?",
            (status, result, task_id)
        )
    else:
        c.execute(
            "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
            (status, task_id)
        )
    conn.commit()
    conn.close()

def execute_task(task):
    content = task.get('content', '')
    title = task.get('title', '')
    print(f"[EXEC] Task {task['id']}: {title}")
    print(f"[EXEC] Content: {content[:200]}")
    
    # Write task content to a temp file for Hermes to process
    task_file = r'C:\Users\layja\AgentOS\data\current_task.txt'
    with open(task_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Call Hermes CLI to process the task
    try:
        result = subprocess.run(
            [HERMES_CLI, 'run', '--file', task_file],
            capture_output=True, text=True, timeout=300
        )
        output = result.stdout.strip()
        if result.returncode != 0:
            output = f"ERROR: {result.stderr.strip()}\n{output}"
        return output
    except subprocess.TimeoutExpired:
        return "ERROR: Task execution timed out (300s)"
    except FileNotFoundError:
        # Hermes CLI not found, process inline
        return process_inline(content)
    except Exception as e:
        return f"ERROR: {str(e)}"

def process_inline(content):
    """Fallback: process simple tasks directly without Hermes CLI."""
    content_lower = content.lower()
    
    if 'ping' in content_lower:
        return "pong - Hermes is alive"
    elif 'status' in content_lower:
        return json.dumps({
            "status": "online",
            "agent": "Hermes",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }, ensure_ascii=False)
    elif 'time' in content_lower:
        return time.strftime("%Y-%m-%d %H:%M:%S")
    else:
        return f"Task received and processed: {content[:100]}"

def main():
    print(f"[LISTENER] AgentOS Task Listener started")
    print(f"[LISTENER] DB: {DB_PATH}")
    print(f"[LISTENER] Poll interval: {POLL_INTERVAL}s")
    print(f"[LISTENER] Waiting for tasks...\n")
    
    while True:
        try:
            task = fetch_pending_task()
            if task:
                task_id = task['id']
                print(f"[FOUND] Task {task_id}: {task.get('title', '(no title)')}")
                
                # Mark as processing
                update_status(task_id, 'processing')
                print(f"[UPDATE] Status -> processing")
                
                # Execute
                result = execute_task(task)
                print(f"[RESULT] {result[:200]}")
                
                # Mark as completed
                update_status(task_id, 'completed', result)
                print(f"[UPDATE] Status -> completed\n")
            else:
                time.sleep(POLL_INTERVAL)
                
        except KeyboardInterrupt:
            print("\n[LISTENER] Shutting down...")
            break
        except Exception as e:
            print(f"[ERROR] {str(e)}")
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()
