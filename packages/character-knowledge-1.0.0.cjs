var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugins/character-knowledge/index.ts
var index_exports = {};
__export(index_exports, {
  abi: () => abi,
  createKnowledge: () => createKnowledge,
  id: () => id,
  version: () => version
});
module.exports = __toCommonJS(index_exports);

// src/main/qq-knowledge-store.ts
var import_node_fs = require("node:fs");
var import_node_crypto = require("node:crypto");
var import_node_path = __toESM(require("node:path"), 1);
var LIMIT = { nodes: 512, bytes: 1024 * 1024, title: 80, text: 2e3, source: 120, input: 8e3, fact: 160 };
var CORRUPT = "QQ knowledge store is corrupt or exceeds limits.";
var INVALID = "Invalid QQ knowledge node.";
var AUTO_SOURCE = "\u7528\u6237\u81EA\u8FF0";
function scopeFields(scope) {
  const match = typeof scope === "string" && /^([1-9]\d{4,11}):(private|group):([1-9]\d{4,11})$/.exec(scope);
  if (!match || match[0] !== scope) throw new Error("Invalid QQ knowledge scope.");
  return { kind: match[2], targetQQ: match[3] };
}
function subject(scope, value, shared = false) {
  if (typeof value !== "string" || (value === "" ? !(shared && scope.kind === "group") : !/^[1-9]\d{4,11}$/.test(value)) || /\D/u.test(value) || scope.kind === "private" && value !== scope.targetQQ) throw new Error(INVALID);
}
function normalized(text) {
  return text.normalize("NFKC").replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu, "").toLowerCase();
}
function sensitive(text) {
  const value = normalized(text);
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || /api[\s_-]*key|password|passwd|\bpwd\b|token|secret|bearer|private[\s_-]*key|\b(?:key|credential)\s*[:=]/iu.test(value) || /密码|密钥|钥匙|口令|令牌|邮箱|邮件|私密|隐私|身份证|银行卡|手机号|电话号码|住址|家庭地址|验证码/u.test(value) || value.includes("@") && /[\p{L}\d._%+-]+\s*@\s*[\p{L}\d.-]+\s*\.\s*[a-z]{2,}/iu.test(value) || /(?:sk-|gh[pousr]_|github_pat_|AKIA)[a-z\d_-]+/iu.test(value) || /eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+/iu.test(value) || /[a-z\d+/_=-]{24,}|(?:\d[\s()+.-]*){7,}/iu.test(value);
}
function textValue(value, maximum, empty = false) {
  if (typeof value !== "string" || value.length > maximum || !empty && !value.trim() || sensitive(value)) throw new Error(INVALID);
  return value.trim();
}
function nodeId(id2) {
  if (typeof id2 !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/iu.test(id2) || id2.length !== 36) throw new Error(INVALID);
}
function edit(value) {
  if (!value || !["profile", "preference", "event", "knowledge"].includes(value.category)) throw new Error(INVALID);
  const fields = scopeFields(value.scope);
  subject(fields, value.subjectQQ, value.category === "knowledge");
  if (value.id !== void 0) nodeId(value.id);
  return {
    id: value.id,
    scope: value.scope,
    subjectQQ: value.subjectQQ,
    category: value.category,
    title: textValue(value.title, LIMIT.title),
    text: textValue(value.text, LIMIT.text),
    source: textValue(value.source ?? "\u73A9\u5BB6\u624B\u52A8", LIMIT.source)
  };
}
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function decode(raw) {
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  if (!record(value) || !exactKeys(value, ["schema", "nodes"]) || value.schema !== 1 || !Array.isArray(value.nodes) || value.nodes.length > LIMIT.nodes) throw new Error(CORRUPT);
  const ids = /* @__PURE__ */ new Set();
  return value.nodes.map((node) => {
    if (!record(node) || !exactKeys(node, ["id", "scope", "subjectQQ", "category", "title", "text", "source", "updatedAt"]) || typeof node.id !== "string" || typeof node.updatedAt !== "string" || !Number.isFinite(Date.parse(node.updatedAt)) || new Date(node.updatedAt).toISOString() !== node.updatedAt || ids.has(node.id)) throw new Error(CORRUPT);
    const clean = edit(node);
    if (clean.id !== node.id || clean.title !== node.title || clean.text !== node.text || clean.source !== node.source) throw new Error(CORRUPT);
    ids.add(node.id);
    return { ...clean, id: node.id, updatedAt: node.updatedAt };
  });
}
function extract(user) {
  if (typeof user !== "string" || user.length > LIMIT.input) return [];
  const facts = [];
  for (const clause of user.split(/[。！？!?；;\r\n，,]/u)) {
    if (sensitive(clause)) continue;
    const match = /^(请叫我|以后叫我|我的名字是|我叫|我不喜欢|我喜欢|我们约定|记住)\s*[：:]?\s*(.+)$/u.exec(clause.trim());
    if (!match) continue;
    const trigger = match[1], text = match[2].normalize("NFKC").replace(/\s+/gu, " ").trim().replace(/[.。！!？?]+$/u, "");
    const name = ["\u8BF7\u53EB\u6211", "\u4EE5\u540E\u53EB\u6211", "\u6211\u7684\u540D\u5B57\u662F", "\u6211\u53EB"].includes(trigger);
    if (!text || text.length > LIMIT.fact || name && (text.length > 32 || !/^[\p{L}\p{N} ·_-]+$/u.test(text))) continue;
    facts.push({
      category: name ? "profile" : trigger.includes("\u559C\u6B22") ? "preference" : trigger === "\u6211\u4EEC\u7EA6\u5B9A" ? "event" : "knowledge",
      title: name ? "\u79F0\u547C" : trigger === "\u6211\u559C\u6B22" ? "\u559C\u6B22" : trigger === "\u6211\u4E0D\u559C\u6B22" ? "\u4E0D\u559C\u6B22" : trigger === "\u6211\u4EEC\u7EA6\u5B9A" ? "\u7EA6\u5B9A" : "\u8BB0\u4F4F",
      text
    });
  }
  return facts;
}
var QQKnowledgeStore = class {
  constructor(directory, clock = Date.now) {
    this.directory = directory;
    this.clock = clock;
    this.file = import_node_path.default.join(directory, "qq-knowledge.json");
  }
  file;
  read() {
    let handle;
    try {
      handle = (0, import_node_fs.openSync)(this.file, "r");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw new Error("Unable to read QQ knowledge store.");
    }
    try {
      const info = (0, import_node_fs.fstatSync)(handle);
      if (!info.isFile() || info.size > LIMIT.bytes) throw new Error(CORRUPT);
      const bytes = Buffer.alloc(LIMIT.bytes + 1);
      let length = 0;
      while (length < bytes.length) {
        const count = (0, import_node_fs.readSync)(handle, bytes, length, bytes.length - length, null);
        if (count === 0) break;
        length += count;
      }
      if (length > LIMIT.bytes) throw new Error(CORRUPT);
      return decode(bytes.subarray(0, length));
    } catch {
      throw new Error(CORRUPT);
    } finally {
      (0, import_node_fs.closeSync)(handle);
    }
  }
  write(nodes) {
    const data = JSON.stringify({ schema: 1, nodes });
    if (nodes.length > LIMIT.nodes || Buffer.byteLength(data, "utf8") > LIMIT.bytes) throw new Error("QQ knowledge store quota limit exceeded.");
    const temporary = `${this.file}.${(0, import_node_crypto.randomUUID)()}.tmp`;
    let handle;
    let created = false;
    try {
      (0, import_node_fs.mkdirSync)(this.directory, { recursive: true, mode: 448 });
      handle = (0, import_node_fs.openSync)(temporary, "wx", 384);
      created = true;
      (0, import_node_fs.writeFileSync)(handle, data, "utf8");
      (0, import_node_fs.fsyncSync)(handle);
      (0, import_node_fs.closeSync)(handle);
      handle = void 0;
      (0, import_node_fs.renameSync)(temporary, this.file);
    } catch {
      throw new Error("Unable to write QQ knowledge store.");
    } finally {
      if (handle !== void 0) {
        try {
          (0, import_node_fs.closeSync)(handle);
        } catch {
        }
      }
      if (created && (0, import_node_fs.existsSync)(temporary)) {
        try {
          (0, import_node_fs.unlinkSync)(temporary);
        } catch {
        }
      }
    }
  }
  list(scope) {
    scopeFields(scope);
    return this.read().filter((node) => node.scope === scope);
  }
  save(value) {
    const clean = edit(value), nodes = this.read();
    const index = clean.id === void 0 ? -1 : nodes.findIndex((node2) => node2.id === clean.id && node2.scope === clean.scope);
    if (clean.id !== void 0 && index < 0) throw new Error(INVALID);
    const node = { ...clean, id: clean.id ?? (0, import_node_crypto.randomUUID)(), updatedAt: new Date(this.clock()).toISOString() };
    if (index < 0) nodes.push(node);
    else nodes[index] = node;
    this.write(nodes);
    return { ...node };
  }
  delete(scope, id2) {
    scopeFields(scope);
    if (id2 !== void 0) nodeId(id2);
    this.write(this.read().filter((node) => node.scope !== scope || id2 !== void 0 && node.id !== id2));
  }
  /** Clear persisted scopes even after their targets have left the allowlist. */
  clearAccount(accountQQ) {
    if (typeof accountQQ !== "string" || !/^[1-9]\d{4,11}$/.test(accountQQ) || /\D/u.test(accountQQ)) throw new Error("Invalid QQ knowledge account.");
    this.write(this.read().filter((node) => !node.scope.startsWith(`${accountQQ}:`)));
  }
  observe(scope, subjectQQ, userText) {
    subject(scopeFields(scope), subjectQQ);
    const facts = extract(userText);
    if (!facts.length) return;
    let nodes = this.read();
    for (const fact of facts) {
      const belongs = (node) => node.scope === scope && node.subjectQQ === subjectQQ && node.category === fact.category;
      if (fact.category === "profile" && nodes.some((node) => belongs(node) && node.title === fact.title && node.source !== AUTO_SOURCE)) continue;
      const previous = nodes.find((node) => belongs(node) && node.source === AUTO_SOURCE && (fact.category === "profile" ? node.title === fact.title : node.title === fact.title && node.text === fact.text));
      nodes = nodes.filter((node) => !(belongs(node) && node.source === AUTO_SOURCE && (node.id === previous?.id || fact.category === "preference" && node.text === fact.text && ["\u559C\u6B22", "\u4E0D\u559C\u6B22"].includes(node.title))));
      nodes.push({ ...fact, scope, subjectQQ, id: previous?.id ?? (0, import_node_crypto.randomUUID)(), source: AUTO_SOURCE, updatedAt: new Date(this.clock()).toISOString() });
    }
    this.write(nodes);
  }
  retrieve(scope, subjectQQ, text, options) {
    subject(scopeFields(scope), subjectQQ, true);
    if (!options || !Number.isInteger(options.topK) || options.topK < 1 || options.topK > 8 || !Number.isInteger(options.retentionDays) || options.retentionDays < 1 || options.retentionDays > 365 || typeof text !== "string" || text.length > LIMIT.input) throw new Error("Invalid QQ knowledge retrieval options.");
    const query = normalized(text).trim(), tokens = /* @__PURE__ */ new Set();
    for (const run of query.match(/[\p{L}\p{N}]+/gu) ?? []) {
      if (new RegExp("\\p{Script=Han}", "u").test(run)) {
        for (let i = 0; i < run.length; i++) tokens.add(run.slice(i, i + 2));
      } else if (run.length > 1) tokens.add(run);
    }
    const time = this.clock();
    return this.read().filter((node) => node.scope === scope && (node.subjectQQ === subjectQQ || node.subjectQQ === "" && node.category === "knowledge")).map((node, index) => {
      const age = Math.max(0, time - Date.parse(node.updatedAt)) / 864e5;
      const haystack = normalized(`${node.title} ${node.text}`);
      let match = query && haystack.includes(query) ? 12 : 0;
      for (const token of tokens) if (haystack.includes(token)) match += token.length === 1 ? 0.5 : 3;
      const basic = node.category === "profile" ? 2 : node.category === "preference" ? 1 : 0;
      return { node, index, score: age >= options.retentionDays ? 0 : (match + basic) * Math.exp(-age / 30) };
    }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.index - right.index).slice(0, options.topK).map((item) => item.node);
  }
};

// plugins/character-knowledge/index.ts
var abi = 1;
var id = "character-knowledge";
var version = "1.0.0";
function createKnowledge(directory) {
  return new QQKnowledgeStore(directory);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  abi,
  createKnowledge,
  id,
  version
});
