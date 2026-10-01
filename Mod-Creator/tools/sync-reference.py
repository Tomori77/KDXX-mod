#!/usr/bin/env python3
"""sync-reference.py: extract machine-readable enums and catalogs from the ModSDK snapshot into src/generated/*.js (stdlib only)."""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

GENERATOR = "sync-reference.py@1"
DEFAULT_SDK = r"D:\1orca\KDXXmod\docs\Reference\ModSDK-0.1.12"

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_OUT = REPO_ROOT / "src" / "generated"
DEFAULT_BUFF_MD = SCRIPT_DIR.parents[1] / "docs" / "口袋修仙全Buff一览.md"


def parse_args():
    parser = argparse.ArgumentParser(description="Generate src/generated/*.js from the ModSDK snapshot.")
    parser.add_argument("--sdk", default=DEFAULT_SDK, help="SDK snapshot root (contains sdk-manifest.json).")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output directory for generated ES modules.")
    parser.add_argument("--buff-md", default=str(DEFAULT_BUFF_MD), help="Path to 口袋修仙全Buff一览.md.")
    return parser.parse_args()


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def make_deref(defs):
    def deref(node):
        seen = set()
        while isinstance(node, dict) and set(node.keys()) == {"$ref"}:
            ref = node["$ref"]
            if not ref.startswith("#/$defs/"):
                break
            name = ref.rsplit("/", 1)[-1]
            if name in seen or name not in defs:
                break
            seen.add(name)
            node = defs[name]
        return node
    return deref


def collect_type_consts(node, deref, depth=0, acc=None):
    if acc is None:
        acc = []
    if depth > 40:
        return acc
    node = deref(node)
    if not isinstance(node, dict):
        return acc
    for key in ("anyOf", "oneOf", "allOf"):
        for branch in node.get(key) or []:
            collect_type_consts(branch, deref, depth + 1, acc)
    props = node.get("properties")
    if isinstance(props, dict) and "type" in props:
        target = deref(props["type"])
        if isinstance(target, dict):
            if "const" in target:
                acc.append(target["const"])
            elif isinstance(target.get("enum"), list):
                acc.extend(target["enum"])
    if node.get("items") is not None:
        collect_type_consts(node["items"], deref, depth + 1, acc)
    return acc


def collect_consts(node, deref, acc=None):
    if acc is None:
        acc = []
    node = deref(node)
    if not isinstance(node, dict):
        return acc
    if "const" in node:
        acc.append(node["const"])
        return acc
    for key in ("anyOf", "oneOf", "allOf"):
        for branch in node.get(key) or []:
            collect_consts(branch, deref, acc)
    return acc


def uniq(values):
    seen = []
    for value in values:
        if value not in seen:
            seen.append(value)
    return seen


def pick(record, fields):
    return {field: record.get(field) for field in fields}


def parse_buff_table(markdown_text):
    lines = markdown_text.splitlines()
    section = False
    result = {}
    row_re = re.compile(r"^\|\s*`([^`]+)`\s*\|(.*)\|\s*$")
    for line in lines:
        if line.startswith("## "):
            section = "总表" in line
            continue
        if not section:
            continue
        match = row_re.match(line.strip())
        if not match:
            continue
        buff_id = match.group(1).strip()
        cells = [cell.strip() for cell in match.group(2).split("|")]
        if len(cells) < 5:
            continue
        label, polarity, buff_type, duration, consume_on = cells[:5]
        try:
            duration_ms = int(duration.replace(",", ""))
        except ValueError:
            duration_ms = duration
        result[buff_id] = {
            "label": label,
            "polarity": polarity,
            "type": buff_type,
            "defaultDurationMs": duration_ms,
            "consumeOn": None if consume_on in ("—", "-", "") else consume_on,
        }
    return result


def write_module(path, header, body):
    path.write_text(header + "\n" + body, encoding="utf-8", newline="\n")


def js_const(name, value):
    return "export const " + name + " = " + json.dumps(value, ensure_ascii=False, indent=2) + ";\n"


def main():
    args = parse_args()
    sdk_root = Path(args.sdk)
    out_dir = Path(args.out)
    buff_md = Path(args.buff_md)

    if not sdk_root.is_dir():
        print("ERROR: sdk root not found: " + str(sdk_root), file=sys.stderr)
        return 1
    manifest_path = sdk_root / "sdk-manifest.json"
    if not manifest_path.is_file():
        print("ERROR: sdk-manifest.json not found: " + str(manifest_path), file=sys.stderr)
        return 1

    manifest = load_json(manifest_path)
    sdk_version = manifest.get("releaseVersion") or manifest.get("packageVersion") or manifest.get("gameVersion")
    if not sdk_version:
        print("ERROR: sdk version missing in sdk-manifest.json", file=sys.stderr)
        return 1

    reference = sdk_root / "reference"
    schema = sdk_root / "schema"
    header = "// generated by tools/sync-reference.py \u2014 DO NOT EDIT (sdk " + sdk_version + ")"
    out_dir.mkdir(parents=True, exist_ok=True)

    item_enums = load_json(reference / "domains" / "items" / "enums.json")
    enums = {
        "addableCategories": item_enums["addableCategories"],
        "grades": item_enums["grades"],
        "elements": item_enums["elements"],
        "distributionChannels": item_enums["distributionChannels"],
        "communityOrdinalRange": item_enums["communityOrdinalRange"],
        "spellTriggerMode": ["rotation", "conditional", "active"],
        "spellRole": ["offense", "defense", "control", "movement", "combo", "support"],
        "spellRewardKind": ["fixed", "choice", "supplemental"],
        "itemModes": ["add", "override", "delete"],
        "domainSchemaVersions": {
            "items": [1, 2, 3],
            "encounters": [1, 2],
            "encounter-placements": [1, 2],
            "enemies": 1,
            "maps": 1,
            "bazaars": 1,
            "adventures": 1,
            "scripts": 1,
            "buffs": 1,
        },
    }
    enums_body = "".join(js_const(name, value) for name, value in enums.items())
    write_module(out_dir / "enums.js", header, enums_body)

    mechanism_catalog = load_json(reference / "domains" / "items" / "mechanism-catalog.json")
    effects_schema = load_json(schema / "domains" / "items" / "item-effects.schema.json")
    defs = effects_schema.get("$defs", {})
    deref = make_deref(defs)
    passive_types = uniq(collect_type_consts(defs["T235"], deref))
    executor_types = uniq(collect_type_consts(defs["T400"], deref))
    triggers = uniq(collect_consts(defs["T173"], deref))
    mechanism = {
        "effectKinds": mechanism_catalog["effectKinds"],
        "passiveTypes": passive_types,
        "executorTypes": executor_types,
        "triggers": triggers,
    }
    mechanism_body = "".join(js_const(name, value) for name, value in mechanism.items())
    write_module(out_dir / "mechanism.js", header, mechanism_body)

    base_items = load_json(reference / "domains" / "items" / "base-item-index.json")["items"]
    item_fields = ["numericId", "name", "category", "grade", "element", "iconBasename", "modOverridePolicy"]
    items = [pick(record, item_fields) for record in base_items]

    base_enemies = load_json(reference / "domains" / "enemies" / "base-enemy-public-catalog.json")["enemies"]
    enemy_fields = ["enemyId", "name", "enemyType", "rank", "modOverridePolicy"]
    enemies = [pick(record, enemy_fields) for record in base_enemies]

    practice_buffs = load_json(reference / "domains" / "encounters" / "practice-buff-catalog.json")["buffs"]
    region_pools = load_json(reference / "domains" / "encounters" / "region-pool-catalog.json")["regions"]
    fixed_nodes = load_json(reference / "domains" / "encounters" / "fixed-node-catalog.json")["nodes"]
    entrances = load_json(reference / "domains" / "maps" / "entrance-catalog.json")["maps"]
    official_backgrounds = load_json(reference / "domains" / "maps" / "official-background-catalog.json")["maps"]
    scripture_spells = load_json(reference / "domains" / "items" / "scripture-spell-catalog.json")["scriptures"]

    catalogs = {
        "items": items,
        "enemies": enemies,
        "practiceBuffs": practice_buffs,
        "regionPools": region_pools,
        "fixedNodes": fixed_nodes,
        "entrances": entrances,
        "officialBackgrounds": official_backgrounds,
        "scriptureSpells": scripture_spells,
    }
    catalogs_body = "".join(js_const(name, value) for name, value in catalogs.items())
    write_module(out_dir / "catalogs.js", header, catalogs_body)

    markdown_text = buff_md.read_text(encoding="utf-8")
    buff_dict = parse_buff_table(markdown_text)
    buff_body = js_const("buffDict", buff_dict)
    write_module(out_dir / "buffDict.js", header, buff_body)

    version = {
        "sdkVersion": sdk_version,
        "generatedAtISO": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "generator": GENERATOR,
    }
    write_module(out_dir / "VERSION.js", header, js_const("VERSION", version))

    index_body = (
        'export * from "./enums.js";\n'
        'export * from "./mechanism.js";\n'
        'export * from "./catalogs.js";\n'
        'export * from "./buffDict.js";\n'
        'export * from "./VERSION.js";\n'
    )
    write_module(out_dir / "index.js", header, index_body)

    print("sdkVersion:", sdk_version)
    print("generated:", out_dir)
    print("enums:", len(enums), "groups")
    print("mechanism.effectKinds:", len(mechanism["effectKinds"]))
    print("mechanism.passiveTypes:", len(passive_types))
    print("mechanism.executorTypes:", len(executor_types))
    print("mechanism.triggers:", len(triggers))
    print("catalogs.items:", len(items))
    print("catalogs.enemies:", len(enemies))
    print("catalogs.practiceBuffs:", len(practice_buffs))
    print("catalogs.regionPools:", len(region_pools))
    print("catalogs.fixedNodes:", len(fixed_nodes))
    print("catalogs.entrances:", len(entrances))
    print("catalogs.officialBackgrounds:", len(official_backgrounds))
    print("catalogs.scriptureSpells:", len(scripture_spells))
    print("buffDict:", len(buff_dict))
    return 0


if __name__ == "__main__":
    sys.exit(main())
