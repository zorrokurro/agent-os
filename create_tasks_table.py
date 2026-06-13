import sqlite3

conn = sqlite3.connect(r'C:\Users\layja\AgentOS\data\ump.db')
c = conn.cursor()

c.execute('''CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  result TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
)''')

c.execute('''CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)''')
c.execute('''CREATE INDEX IF NOT EXISTS idx_tasks_target ON tasks(target)''')

conn.commit()

# Verify
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", c.fetchall())
c.execute("PRAGMA table_info(tasks)")
print("tasks columns:", c.fetchall())
c.execute("SELECT COUNT(*) FROM tasks")
print("Row count:", c.fetchone()[0])

conn.close()
