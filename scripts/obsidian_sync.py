#!/usr/bin/env python3
"""
obsidian_sync.py
每 15 分鐘將 Obsidian 檔案同步到 OpenHuman workspace。
"""

import os
import sys
import shutil
import time
import hashlib
import logging
from datetime import datetime
from pathlib import Path

# 路徑設定
BASE = Path("/mnt/c/Users/layja")

SOURCES = {
    "user_profile.md": BASE / "obsidian" / "使用者檔案.md",
    "daily_summary.md": BASE / "obsidian" / "AgentOS" / "reports" / "daily_summary.md",
    "builder_progress.md": BASE / "obsidian" / "AgentOS" / "progress" / "builder_progress.md",
}

TARGET_DIR = BASE / ".openhuman" / "users" / "6a1e3774d0854eb39497b5d5" / "workspace"
SYNC_INTERVAL = 15 * 60  # 15 分鐘

LOG_FILE = TARGET_DIR / "sync.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("obsidian_sync")


def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def sync_file(src: Path, dst: Path) -> bool:
    if not src.exists():
        logger.warning(f"來源不存在，跳過：{src}")
        return False
    if not dst.exists():
        shutil.copy2(src, dst)
        logger.info(f"新增 -> {dst.name}")
        return True
    if md5(src) == md5(dst):
        logger.debug(f"無變更，跳過：{src.name}")
        return False
    shutil.copy2(src, dst)
    logger.info(f"更新 -> {dst.name}")
    return True


def sync_all():
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    results = {}
    for name, src in SOURCES.items():
        dst = TARGET_DIR / name
        try:
            copied = sync_file(src, dst)
            results[name] = "copied" if copied else "unchanged"
        except PermissionError:
            logger.error(f"寫入權限不足：{dst}")
            results[name] = "permission_error"
        except Exception as e:
            logger.error(f"同步失敗 {name}：{e}")
            results[name] = f"error: {e}"

    # 寫入同步狀態檔
    status_file = TARGET_DIR / "sync_status.md"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = ["# Sync Status\n", f"> Last sync: {now}\n\n"]
    for name, status in results.items():
        icon = "OK" if status in ("copied", "unchanged") else "FAIL"
        lines.append(f"- [{icon}] {name}: {status}\n")
    status_file.write_text("".join(lines), encoding="utf-8")
    logger.info(f"Sync done: {results}")
    return results


def daemon_mode():
    logger.info(f"Daemon mode: sync every {SYNC_INTERVAL // 60} min -> {TARGET_DIR}")
    while True:
        try:
            sync_all()
        except KeyboardInterrupt:
            logger.info("Interrupted")
            break
        except Exception as e:
            logger.error(f"Sync error: {e}")
        time.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    if "--daemon" in sys.argv:
        daemon_mode()
    else:
        results = sync_all()
        changed = sum(1 for v in results.values() if v == "copied")
        print(f"Done: {changed} updated, {len(results) - changed} unchanged")
