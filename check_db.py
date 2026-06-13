import sqlite3
conn = sqlite3.connect(r'C:\Users\layja\AgentOS\data\ump.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('Tables:', c.fetchall())
for table in ['tasks']:
    try:
        c.execute(f'PRAGMA table_info({table})')
        print(f'{table} cols:', c.fetchall())
        c.execute(f'SELECT * FROM {table} LIMIT 1')
        print(f'{table} sample:', c.fetchone())
    except Exception as e:
        print(f'{table} error:', e)
conn.close()
