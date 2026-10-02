"""Mod-Creator 本地伴随服务（标准库实现，仅监听本机）。"""

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import re
import shutil
import string
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP_ID = "4777710"
SERVICE_NAME = "Mod-Creator"
SERVICE_VERSION = 1
CAPABILITIES = ["fs", "folder", "steamcmd"]
META_NAME = ".mc-project.json"
STEAM_CFG_NAME = ".mc-steam.json"
WORKSHOP_VDF_NAME = ".mc-workshop.vdf"
INTERNAL_FILES = {META_NAME, WORKSHOP_VDF_NAME}
IMAGE_EXTS = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".tga"}
PORT_RANGE_END = 8775

ERRORS_ZH = {
    "badRequest": "请求体不合法",
    "hostRejected": "拒绝访问：Host 不是本机",
    "fs.invalid": "路径不合法",
    "fs.notFound": "路径不存在",
    "fs.notDir": "目标不是目录",
    "fs.denied": "无权限访问该路径",
    "fs.outsideEdit": "路径不在 edit 工作副本目录内",
    "project.exists": "同名工作副本已存在",
    "project.missing": "工作副本不存在",
    "project.noSource": "找不到原工程目录",
    "steam.notFound": "未找到 steamcmd.exe",
    "steam.needUser": "请先填写 Steam 用户名",
    "steam.loginRequired": "steamcmd 未登录或登录已失效",
    "steam.confirmRequired": "上传前必须确认变更",
    "steam.failed": "steamcmd 执行失败",
    "steam.timeout": "steamcmd 执行超时",
    "internal": "服务器内部错误",
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
}


class ApiError(Exception):
    def __init__(self, code, message_zh=None, extra=None, status=200):
        super().__init__(code)
        self.code = code
        self.message_zh = message_zh or ERRORS_ZH.get(code, "未知错误")
        self.extra = extra or {}
        self.status = status


def read_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        if default is None:
            return {}
        return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def normalize_path(path):
    if re.fullmatch(r"[A-Za-z]:", path or ""):
        path = path + "\\"
    return os.path.normpath(os.path.abspath(os.path.expanduser(path)))


def ensure_in_edit(edit_root, target, allow_root=False):
    edit_real = os.path.realpath(edit_root)
    target_real = os.path.realpath(target)
    if not allow_root and target_real == edit_real:
        raise ApiError("fs.outsideEdit")
    if target_real != edit_real and not target_real.startswith(edit_real + os.sep):
        raise ApiError("fs.outsideEdit")
    return target_real


def sanitize_name(name):
    if not name:
        return ""
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(name))
    cleaned = cleaned.strip().strip(".").strip()
    return cleaned.strip()


def detect_kind(directory):
    if os.path.isfile(os.path.join(directory, "manifest.json")):
        return "mod"
    try:
        for entry in os.listdir(directory):
            if entry.lower().endswith(".modcreator.json"):
                return "project"
    except OSError:
        pass
    return "unknown"


def list_relative_files(root, skip_internal=True):
    result = {}
    for dirpath, dirnames, filenames in os.walk(root):
        for filename in filenames:
            full = os.path.join(dirpath, filename)
            rel = os.path.relpath(full, root).replace("\\", "/")
            if skip_internal and rel in INTERNAL_FILES:
                continue
            result[rel] = full
    return result


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_file_content(path):
    with open(path, "rb") as handle:
        data = handle.read()
    ext = os.path.splitext(path)[1].lower()
    if ext not in IMAGE_EXTS:
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            pass
    return {"base64": base64.b64encode(data).decode("ascii")}


def decode_file_content(content):
    if isinstance(content, dict) and "base64" in content:
        return base64.b64decode(content["base64"])
    if isinstance(content, str):
        return content.encode("utf-8")
    if content is None:
        return b""
    if isinstance(content, (dict, list)):
        return json.dumps(content, ensure_ascii=False, indent=2).encode("utf-8")
    return str(content).encode("utf-8")


def locate_steamcmd(root):
    candidates = []
    env = os.environ.get("MC_STEAMCMD")
    if env:
        candidates.append(env)
    candidates.append(os.path.join(os.path.dirname(root), "docs", "Upload", "steamcmd.exe"))
    candidates.append(r"D:\Tools\steamworkshop\steamcmd\steamcmd.exe")
    which = shutil.which("steamcmd")
    if which:
        candidates.append(which)
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def vdf_escape(value):
    text = "" if value is None else str(value)
    text = text.replace("\\", "\\\\").replace('"', '\\"')
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    return text


def build_workshop_vdf(fields):
    lines = ['"workshopitem"', "{"]
    for key in (
        "appid",
        "contentfolder",
        "publishedfileid",
        "visibility",
        "title",
        "description",
        "changenote",
        "previewfile",
    ):
        value = fields.get(key)
        if value is None or value == "":
            continue
        lines.append('    "%s" "%s"' % (key, vdf_escape(value)))
    lines.append("}")
    return "\n".join(lines) + "\n"


def parse_published_file_id(output):
    if not output:
        return None
    patterns = [
        r"Successfully created new workshop item[^\d]*(\d+)",
        r"publishedfileid[^\d]*(\d+)",
        r"PublishedFileId[^\d]*(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, output, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def looks_like_login_required(output):
    if not output:
        return False
    low = output.lower()
    markers = [
        "invalid password",
        "login failure",
        "failed to login",
        "account logon denied",
        "please enter the password",
        "password:",
        "steamguard",
        "two-factor",
        "requires two-factor",
        "steam guard code",
    ]
    return any(marker in low for marker in markers)


class LocalService:
    def __init__(self, root):
        self.root = os.path.realpath(root)
        self.edit_root = os.path.join(self.root, "edit")
        os.makedirs(self.edit_root, exist_ok=True)

    def project_path(self, name):
        cleaned = sanitize_name(name)
        if not cleaned or cleaned != str(name).strip():
            raise ApiError("fs.invalid")
        if cleaned in (".", ".."):
            raise ApiError("fs.invalid")
        target = os.path.join(self.edit_root, cleaned)
        ensure_in_edit(self.edit_root, target)
        return target

    def project_meta(self, directory):
        return read_json(os.path.join(directory, META_NAME), {})

    def collect_files(self, root):
        files = []
        for rel, full in sorted(list_relative_files(root).items()):
            files.append({"path": rel, "content": read_file_content(full)})
        return files

    def project_summary(self, name):
        directory = os.path.join(self.edit_root, name)
        meta = self.project_meta(directory)
        kind = meta.get("kind") or detect_kind(directory)
        workshop = meta.get("workshop")
        return {
            "name": name,
            "path": directory,
            "kind": kind,
            "sourcePath": meta.get("sourcePath"),
            "updatedAt": int(os.path.getmtime(directory) * 1000),
            "workshop": workshop if isinstance(workshop, dict) else None,
        }

    def steam_user(self):
        cfg = read_json(os.path.join(self.edit_root, STEAM_CFG_NAME), {})
        user = cfg.get("user")
        return user if isinstance(user, str) and user.strip() else None

    def ping(self):
        return {
            "name": SERVICE_NAME,
            "serviceVersion": SERVICE_VERSION,
            "appId": APP_ID,
            "capabilities": list(CAPABILITIES),
        }

    def fs_roots(self):
        drives = [letter + ":\\" for letter in string.ascii_uppercase if os.path.exists(letter + ":\\")]
        return {"workspaceRoot": self.root, "editRoot": self.edit_root, "drives": drives}

    def fs_browse(self, path):
        if path:
            target = normalize_path(path)
        else:
            target = self.root
        if not os.path.exists(target):
            raise ApiError("fs.notFound")
        if not os.path.isdir(target):
            raise ApiError("fs.notDir")
        parent = os.path.dirname(target)
        if not parent or os.path.normpath(parent) == os.path.normpath(target):
            parent = None
        dirs = []
        files = []
        try:
            with os.scandir(target) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir():
                            dirs.append({"name": entry.name, "path": entry.path})
                        elif entry.is_file():
                            stat = entry.stat()
                            files.append({
                                "name": entry.name,
                                "path": entry.path,
                                "size": stat.st_size,
                                "mtime": int(stat.st_mtime * 1000),
                            })
                    except OSError:
                        continue
        except PermissionError:
            raise ApiError("fs.denied")
        except OSError:
            raise ApiError("fs.denied")
        dirs.sort(key=lambda item: item["name"].lower())
        files.sort(key=lambda item: item["name"].lower())
        return {"path": target, "parent": parent, "dirs": dirs, "files": files}

    def fs_mkdir(self, path):
        if not path:
            raise ApiError("fs.invalid")
        target = normalize_path(path)
        ensure_in_edit(self.edit_root, target)
        if os.path.exists(target) and not os.path.isdir(target):
            raise ApiError("fs.invalid")
        try:
            os.makedirs(target, exist_ok=True)
        except PermissionError:
            raise ApiError("fs.denied")
        except OSError:
            raise ApiError("fs.invalid")
        return {"path": target}

    def fs_delete(self, path):
        if not path:
            raise ApiError("fs.invalid")
        target = normalize_path(path)
        ensure_in_edit(self.edit_root, target)
        if not os.path.exists(target):
            raise ApiError("fs.notFound")
        try:
            if os.path.isdir(target) and not os.path.islink(target):
                shutil.rmtree(target)
            else:
                os.remove(target)
        except PermissionError:
            raise ApiError("fs.denied")
        except OSError:
            raise ApiError("fs.invalid")
        return {}

    def fs_reveal(self, path):
        target = normalize_path(path) if path else self.edit_root
        try:
            if os.path.exists(target):
                subprocess.Popen(["explorer", "/select,", target])
            else:
                parent = os.path.dirname(target)
                if os.path.isdir(parent):
                    subprocess.Popen(["explorer", parent])
                else:
                    raise ApiError("fs.notFound")
        except ApiError:
            raise
        except OSError:
            raise ApiError("fs.denied")
        return {}

    def projects_list(self):
        projects = []
        try:
            entries = os.listdir(self.edit_root)
        except OSError:
            entries = []
        for name in entries:
            directory = os.path.join(self.edit_root, name)
            if not os.path.isdir(directory) or name.startswith("."):
                continue
            projects.append(self.project_summary(name))
        projects.sort(key=lambda item: item["updatedAt"], reverse=True)
        return {"projects": projects}

    def projects_import(self, source, name, overwrite):
        if not source:
            raise ApiError("project.noSource")
        source_real = os.path.realpath(source)
        if not os.path.exists(source_real):
            raise ApiError("project.noSource")
        if not os.path.isdir(source_real):
            raise ApiError("project.noSource")
        chosen = sanitize_name(name) if name else sanitize_name(os.path.basename(source_real))
        if not chosen:
            chosen = "project"
        target = os.path.join(self.edit_root, chosen)
        ensure_in_edit(self.edit_root, target)
        if os.path.exists(target):
            if not overwrite:
                raise ApiError("project.exists")
            ensure_in_edit(self.edit_root, target)
            shutil.rmtree(target)
        kind = detect_kind(source_real)
        try:
            shutil.copytree(source_real, target)
        except (OSError, shutil.Error):
            raise ApiError("fs.denied")
        meta = {
            "kind": kind,
            "sourcePath": source_real,
            "importedAt": int(time.time() * 1000),
            "workshop": None,
        }
        write_json(os.path.join(target, META_NAME), meta)
        return {
            "name": chosen,
            "path": target,
            "kind": kind,
            "sourcePath": source_real,
            "files": self.collect_files(target),
        }

    def projects_read(self, name):
        if not name:
            raise ApiError("project.missing")
        directory = os.path.join(self.edit_root, sanitize_name(name))
        if not os.path.isdir(directory):
            raise ApiError("project.missing")
        meta = self.project_meta(directory)
        kind = meta.get("kind") or detect_kind(directory)
        workshop = meta.get("workshop")
        return {
            "name": sanitize_name(name),
            "path": directory,
            "kind": kind,
            "sourcePath": meta.get("sourcePath"),
            "workshop": workshop if isinstance(workshop, dict) else None,
            "files": self.collect_files(directory),
        }

    def projects_save(self, name, files, delete_stale):
        if not name:
            raise ApiError("project.missing")
        directory = os.path.join(self.edit_root, sanitize_name(name))
        if not os.path.isdir(directory):
            raise ApiError("project.missing")
        written = []
        for item in files or []:
            rel = str(item.get("path", "")).replace("\\", "/").lstrip("/")
            if not rel:
                continue
            target = normalize_path(os.path.join(directory, rel))
            if not target.startswith(os.path.realpath(directory) + os.sep):
                raise ApiError("fs.outsideEdit")
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                with open(target, "wb") as handle:
                    handle.write(decode_file_content(item.get("content")))
            except PermissionError:
                raise ApiError("fs.denied")
            except OSError:
                raise ApiError("fs.invalid")
            written.append(rel)
        if delete_stale:
            keep = set(written)
            existing = list_relative_files(directory)
            for rel, full in existing.items():
                if rel not in keep:
                    try:
                        os.remove(full)
                    except OSError:
                        continue
        return {"name": sanitize_name(name), "written": written}

    def projects_delete(self, name):
        if not name:
            raise ApiError("project.missing")
        target = os.path.join(self.edit_root, sanitize_name(name))
        ensure_in_edit(self.edit_root, target)
        if not os.path.isdir(target):
            raise ApiError("project.missing")
        try:
            shutil.rmtree(target)
        except PermissionError:
            raise ApiError("fs.denied")
        except OSError:
            raise ApiError("fs.invalid")
        return {}

    def projects_merge_report(self, name):
        if not name:
            raise ApiError("project.missing")
        clean = sanitize_name(name)
        working = os.path.join(self.edit_root, clean)
        if not os.path.isdir(working):
            raise ApiError("project.missing")
        meta = self.project_meta(working)
        source = meta.get("sourcePath")
        if not source or not os.path.isdir(source):
            raise ApiError("project.noSource")
        source_files = list_relative_files(source)
        working_files = list_relative_files(working)
        changed = []
        for rel in sorted(set(source_files) | set(working_files)):
            in_source = rel in source_files
            in_working = rel in working_files
            if in_working and not in_source:
                changed.append({"path": rel, "status": "added"})
            elif in_source and not in_working:
                changed.append({"path": rel, "status": "removed"})
            elif sha256_file(source_files[rel]) != sha256_file(working_files[rel]):
                changed.append({"path": rel, "status": "modified"})
        added = sum(1 for item in changed if item["status"] == "added")
        modified = sum(1 for item in changed if item["status"] == "modified")
        removed = sum(1 for item in changed if item["status"] == "removed")
        summary = "共 %d 处变更：新增 %d，修改 %d，删除 %d。" % (len(changed), added, modified, removed)
        return {
            "name": clean,
            "sourcePath": source,
            "workingPath": working,
            "changed": changed,
            "summaryZh": summary,
        }

    def projects_rename(self, name, new_name):
        if not name or not new_name:
            raise ApiError("badRequest")
        old = os.path.join(self.edit_root, sanitize_name(name))
        if not os.path.isdir(old):
            raise ApiError("project.missing")
        clean_new = sanitize_name(new_name)
        if not clean_new:
            raise ApiError("fs.invalid")
        target = os.path.join(self.edit_root, clean_new)
        ensure_in_edit(self.edit_root, target)
        if os.path.exists(target):
            raise ApiError("project.exists")
        try:
            os.rename(old, target)
        except OSError:
            raise ApiError("fs.invalid")
        meta = self.project_meta(target)
        if meta:
            write_json(os.path.join(target, META_NAME), meta)
        return {"name": clean_new}

    def steam_status(self, user):
        steamcmd = locate_steamcmd(self.root)
        if not steamcmd:
            raise ApiError("steam.notFound")
        chosen = (user or "").strip() or self.steam_user()
        if not chosen:
            return {
                "steamcmdPath": steamcmd,
                "user": None,
                "loggedIn": False,
                "needUser": True,
                "needLogin": False,
            }
        output = ""
        try:
            result = subprocess.run(
                [steamcmd, "+login", chosen, "+quit"],
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=40,
            )
            output = (result.stdout or "") + (result.stderr or "")
        except subprocess.TimeoutExpired as exc:
            output = (exc.stdout or "") + (exc.stderr or "") if (exc.stdout or exc.stderr) else ""
            if isinstance(output, bytes):
                output = output.decode("utf-8", "replace")
        except OSError:
            raise ApiError("steam.notFound")
        low = output.lower()
        logged_in = ("logged in ok" in low) or ("waiting for user info...ok" in low)
        return {
            "steamcmdPath": steamcmd,
            "user": chosen,
            "loggedIn": logged_in,
            "needUser": False,
            "needLogin": not logged_in,
        }

    def steam_login(self, user):
        chosen = (user or "").strip()
        if not chosen:
            raise ApiError("badRequest")
        steamcmd = locate_steamcmd(self.root)
        if not steamcmd:
            raise ApiError("steam.notFound")
        write_json(os.path.join(self.edit_root, STEAM_CFG_NAME), {"user": chosen})
        command = ["cmd", "/k", '"%s" +login %s' % (steamcmd, chosen)]
        kwargs = {}
        if hasattr(subprocess, "CREATE_NEW_CONSOLE"):
            kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE
        try:
            subprocess.Popen(command, **kwargs)
        except OSError:
            raise ApiError("steam.failed")
        return {"launched": True}

    def steam_publish(self, payload):
        if payload.get("confirm") is not True:
            raise ApiError("steam.confirmRequired")
        name = sanitize_name(payload.get("name"))
        if not name:
            raise ApiError("badRequest")
        working = os.path.join(self.edit_root, name)
        if not os.path.isdir(working):
            raise ApiError("project.missing")
        steamcmd = locate_steamcmd(self.root)
        if not steamcmd:
            raise ApiError("steam.notFound")
        user = (payload.get("user") or "").strip() or self.steam_user()
        if not user:
            raise ApiError("steam.needUser")
        existing_id = str(payload.get("publishedFileId") or "").strip()
        preview = payload.get("previewPath")
        preview_file = ""
        if preview:
            preview_file = preview if os.path.isabs(preview) else os.path.join(working, preview)
            preview_file = normalize_path(preview_file)
        visibility = payload.get("visibility")
        if visibility is None:
            visibility = 0
        fields = {
            "appid": APP_ID,
            "contentfolder": os.path.realpath(working),
            "publishedfileid": existing_id if existing_id else None,
            "visibility": visibility,
            "title": payload.get("title") or name,
            "description": payload.get("description") or "",
            "changenote": payload.get("changenote") or "",
            "previewfile": preview_file,
        }
        vdf_path = os.path.join(working, WORKSHOP_VDF_NAME)
        with open(vdf_path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(build_workshop_vdf(fields))
        output = ""
        try:
            result = subprocess.run(
                [steamcmd, "+login", user, "+workshop_build_item", vdf_path, "+quit"],
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=900,
            )
            output = (result.stdout or "") + (result.stderr or "")
            returncode = result.returncode
        except subprocess.TimeoutExpired as exc:
            raise ApiError("steam.timeout")
        except OSError:
            raise ApiError("steam.notFound")
        if looks_like_login_required(output):
            raise ApiError("steam.loginRequired", extra={"output": output[-8000:]})
        published = parse_published_file_id(output)
        created = False
        if existing_id:
            published = existing_id
        else:
            created = True
        if created and not published:
            raise ApiError("steam.failed", extra={"output": output[-8000:]})
        if returncode != 0 and not published:
            raise ApiError("steam.failed", extra={"output": output[-8000:]})
        meta = self.project_meta(working)
        if not meta:
            meta = {"kind": detect_kind(working), "sourcePath": None}
        meta["workshop"] = {"publishedFileId": published, "title": fields["title"]}
        write_json(os.path.join(working, META_NAME), meta)
        return {"publishedFileId": published, "output": output, "created": created}


class Handler(BaseHTTPRequestHandler):
    server_version = "ModCreatorLocal/1"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[server] " + (fmt % args) + "\n")

    @property
    def service(self):
        return self.server.service

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def host_allowed(self):
        host = self.headers.get("Host", "")
        if not host:
            return False
        hostname = host
        if hostname.startswith("["):
            hostname = hostname[1:hostname.find("]")]
        elif ":" in hostname:
            hostname = hostname.rsplit(":", 1)[0]
        return hostname.lower() in ("127.0.0.1", "localhost")

    def read_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError("badRequest")

    def query_params(self):
        parsed = urllib.parse.urlparse(self.path)
        return {key: values[0] for key, values in urllib.parse.parse_qs(parsed.query).items()}

    def request_path(self):
        return urllib.parse.urlparse(self.path).path

    def do_GET(self):
        self.handle_request("GET")

    def do_POST(self):
        self.handle_request("POST")

    def handle_request(self, method):
        try:
            if not self.host_allowed():
                raise ApiError("hostRejected", status=403)
            path = self.request_path()
            if path.startswith("/api/"):
                self.dispatch_api(method, path)
            elif method == "GET":
                self.serve_static(path)
            else:
                self.send_error(405)
        except ApiError as exc:
            self.emit_error(exc)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("[server] unhandled: %r\n" % (exc,))
            self.emit_error(ApiError("internal"))

    def emit_error(self, exc):
        error = {"code": exc.code, "messageZh": exc.message_zh}
        error.update(exc.extra)
        try:
            self.send_json({"ok": False, "error": error}, status=exc.status)
        except OSError:
            pass

    def dispatch_api(self, method, path):
        params = self.query_params()
        body = self.read_body() if method == "POST" else {}
        service = self.service
        data = None
        if method == "GET":
            if path == "/api/ping":
                data = service.ping()
            elif path == "/api/fs/roots":
                data = service.fs_roots()
            elif path == "/api/fs/browse":
                data = service.fs_browse(params.get("path"))
            elif path == "/api/projects":
                data = service.projects_list()
            elif path == "/api/projects/read":
                data = service.projects_read(params.get("name"))
            else:
                raise ApiError("badRequest")
        else:
            if path == "/api/fs/mkdir":
                data = service.fs_mkdir(body.get("path"))
            elif path == "/api/fs/delete":
                data = service.fs_delete(body.get("path"))
            elif path == "/api/fs/reveal":
                data = service.fs_reveal(body.get("path"))
            elif path == "/api/projects/import":
                data = service.projects_import(
                    body.get("source"), body.get("name"), bool(body.get("overwrite"))
                )
            elif path == "/api/projects/save":
                data = service.projects_save(
                    body.get("name"), body.get("files"), bool(body.get("deleteStale"))
                )
            elif path == "/api/projects/delete":
                data = service.projects_delete(body.get("name"))
            elif path == "/api/projects/merge-report":
                data = service.projects_merge_report(body.get("name"))
            elif path == "/api/projects/rename":
                data = service.projects_rename(body.get("name"), body.get("newName"))
            elif path == "/api/steam/status":
                data = service.steam_status(body.get("user"))
            elif path == "/api/steam/login":
                data = service.steam_login(body.get("user"))
            elif path == "/api/steam/publish":
                data = service.steam_publish(body)
            else:
                raise ApiError("badRequest")
        self.send_json({"ok": True, "data": data})

    def serve_static(self, path):
        decoded = urllib.parse.unquote(path)
        if decoded.endswith("/") or decoded == "":
            decoded = decoded + "index.html"
        root = self.service.root
        candidate = os.path.realpath(os.path.join(root, decoded.lstrip("/")))
        if candidate != root and not candidate.startswith(root + os.sep):
            self.send_error(403)
            return
        if os.path.isdir(candidate):
            candidate = os.path.join(candidate, "index.html")
        if not os.path.isfile(candidate):
            self.send_error(404)
            return
        ext = os.path.splitext(candidate)[1].lower()
        content_type = CONTENT_TYPES.get(ext) or mimetypes.guess_type(candidate)[0] or "application/octet-stream"
        try:
            with open(candidate, "rb") as handle:
                body = handle.read()
        except OSError:
            self.send_error(403)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, service):
        self.service = service
        super().__init__(address, handler)


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Mod-Creator 本地伴随服务")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    parser.add_argument("--no-browser", action="store_true")
    return parser.parse_args(argv)


def bind_server(service, bind, port):
    ports = list(range(port, max(port + 1, PORT_RANGE_END + 1)))
    last_error = None
    for candidate in ports:
        try:
            server = Server((bind, candidate), Handler, service)
            return server, candidate
        except OSError as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
    raise OSError("no port available")


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])
    service = LocalService(args.root)
    server, port = bind_server(service, args.bind, args.port)
    url = "http://%s:%d/index.html" % (args.bind, port)
    sys.stderr.write("[server] root=%s\n" % service.root)
    sys.stderr.write("[server] 监听 http://%s:%d/\n" % (args.bind, port))
    if not args.no_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
