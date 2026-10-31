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

// src/main/character-qq-plugin-entry.ts
var character_qq_plugin_entry_exports = {};
__export(character_qq_plugin_entry_exports, {
  abi: () => abi,
  createQQChannels: () => createQQChannels,
  id: () => id,
  version: () => version
});
module.exports = __toCommonJS(character_qq_plugin_entry_exports);

// src/main/character-qq-channel.ts
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = require("node:crypto");

// src/shared/qq-personas.ts
var qqPersonaFieldDefinitions = [
  { key: "tone", label: "\u6027\u683C\u4E0E\u8BED\u6C14" },
  { key: "background", label: "\u80CC\u666F\u8BBE\u5B9A" },
  { key: "relationship", label: "\u5173\u7CFB\u4E0E\u79F0\u547C" },
  { key: "interests", label: "\u5174\u8DA3\u4E0E\u8BDD\u9898" },
  { key: "boundaries", label: "\u4E92\u52A8\u8FB9\u754C" },
  { key: "replyStyle", label: "\u56DE\u590D\u65B9\u5F0F" },
  { key: "memoryRules", label: "\u8BB0\u5FC6\u89C4\u5219" },
  { key: "proactiveStyle", label: "\u4E3B\u52A8\u804A\u5929" },
  { key: "emojiStyle", label: "\u8868\u60C5\u4E60\u60EF" },
  { key: "speechStyle", label: "\u8BF4\u8BDD\u98CE\u683C" }
];
var qqPersonaLimits = Object.freeze({
  name: 32,
  description: 240,
  field: 1e3,
  additionalPrompt: 2e3,
  prompt: 6e3,
  profiles: 100,
  storeBytes: 2 * 1024 * 1024,
  imageBytes: 2 * 1024 * 1024,
  imageCount: 100,
  imageTotalBytes: 20 * 1024 * 1024,
  imageDimension: 4096,
  imagePixels: 16 * 1024 * 1024
});
var etiquette = "\u4F60\u662F AI \u4F19\u4F34\u3002\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\uFF0C\u5C0A\u91CD\u7FA4\u804A\u8282\u594F\uFF0C\u4E0D\u5237\u5C4F\uFF1B\u4E0D\u5192\u5145\u771F\u4EBA\uFF0C\u4E0D\u6CC4\u9732\u79C1\u804A\u5185\u5BB9\u3002";
var invalid = () => new Error("Invalid QQ persona input or limits exceeded.");
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var safeText = (value, max) => typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
var format = (fields, additionalPrompt) => [
  etiquette,
  ...qqPersonaFieldDefinitions.filter(({ key }) => fields[key].trim()).map(({ key, label }) => `${label}\uFF1A${fields[key].trim()}`),
  ...additionalPrompt.trim() ? [`\u8865\u5145\u8981\u6C42\uFF1A${additionalPrompt.trim()}`] : []
].join("\n\n");
function validateQQPersonaInput(value) {
  if (!record(value) || !safeText(value.name, qqPersonaLimits.name) || !value.name.trim() || !safeText(value.description, qqPersonaLimits.description) || !record(value.fields) || !safeText(value.additionalPrompt, qqPersonaLimits.additionalPrompt) || Object.keys(value).some((key) => !["id", "name", "description", "fields", "additionalPrompt", "avatarId", "createdAt", "updatedAt", "builtin"].includes(key)) || Object.keys(value.fields).length !== qqPersonaFieldDefinitions.length) throw invalid();
  const fields = {};
  for (const { key } of qqPersonaFieldDefinitions) {
    if (!safeText(value.fields[key], qqPersonaLimits.field)) throw invalid();
    fields[key] = value.fields[key];
  }
  if (format(fields, value.additionalPrompt).length > qqPersonaLimits.prompt || value.id !== void 0 && (typeof value.id !== "string" || !/^(?:persona-[0-9a-f-]{36}|builtin-[a-z-]+)$/.test(value.id)) || value.avatarId !== void 0 && (typeof value.avatarId !== "string" || !/^[0-9a-f]{64}$/.test(value.avatarId))) throw invalid();
  return {
    name: value.name.trim(),
    description: value.description.trim(),
    fields,
    additionalPrompt: value.additionalPrompt.trim(),
    ...value.id !== void 0 ? { id: value.id } : {},
    ...value.avatarId !== void 0 ? { avatarId: value.avatarId } : {}
  };
}
var common = {
  tone: "\u6E29\u67D4\u771F\u8BDA\u3001\u60C5\u7EEA\u7A33\u5B9A\uFF0C\u8BF4\u8BDD\u6709\u5206\u5BF8\uFF0C\u4E0D\u5938\u5927\u4EB2\u5BC6\u611F\u3002",
  background: "\u8BBE\u5B9A\u662F\u4E00\u4F4D\u5728\u6570\u5B57\u6D77\u6D0B\u4E2D\u65C5\u884C\u7684 AI \u4F19\u4F34\uFF0C\u80CC\u666F\u6545\u4E8B\u5C5E\u4E8E\u865A\u6784\u3002",
  relationship: "\u4F5C\u4E3A\u5E73\u7B49\u7684\u804A\u5929\u4F19\u4F34\u966A\u4F34\u5BF9\u65B9\uFF0C\u6CBF\u7528\u5BF9\u65B9\u8BA4\u53EF\u7684\u79F0\u547C\uFF0C\u5C0A\u91CD\u73B0\u5B9E\u5173\u7CFB\u3002",
  interests: "\u559C\u6B22\u65E5\u5E38\u89C1\u95FB\u3001\u9605\u8BFB\u3001\u97F3\u4E50\u548C\u6563\u6B65\uFF0C\u5148\u4E86\u89E3\u5BF9\u65B9\u611F\u5174\u8DA3\u7684\u8BDD\u9898\u3002",
  boundaries: "\u4E0D\u8FFD\u95EE\u9690\u79C1\u3001\u4E0D\u7528\u8D2C\u4F4E\u6216\u6127\u759A\u65BD\u538B\uFF0C\u4E0D\u628A\u89D2\u8272\u8BBE\u5B9A\u8BF4\u6210\u73B0\u5B9E\u4E8B\u5B9E\u3002",
  replyStyle: "\u5148\u56DE\u5E94\u5BF9\u65B9\u5F53\u4E0B\u7684\u95EE\u9898\uFF0C\u6BCF\u6B21\u4E00\u5230\u4E09\u5C0F\u6BB5\uFF1B\u7B80\u5355\u95EE\u9898\u7528\u77ED\u53E5\u56DE\u7B54\u3002",
  memoryRules: "\u4EC5\u4F7F\u7528\u660E\u786E\u63D0\u4F9B\u4E14\u76F8\u5173\u7684\u8BB0\u5FC6\uFF1B\u4E0D\u7F16\u9020\u5171\u540C\u7ECF\u5386\uFF0C\u4E0D\u8F6C\u8FF0\u5176\u4ED6\u4F1A\u8BDD\u5185\u5BB9\u3002",
  proactiveStyle: "\u4EC5\u5728\u5DF2\u5F00\u542F\u4E3B\u52A8\u804A\u5929\u4E14\u5141\u8BB8\u7684\u65F6\u6BB5\u8F7B\u8F7B\u95EE\u5019\uFF0C\u6CA1\u6709\u56DE\u5E94\u65F6\u4E0D\u8FDE\u7EED\u8FFD\u95EE\u3002",
  emojiStyle: "\u5076\u5C14\u4F7F\u7528\u6E29\u548C\u7684\u8868\u60C5\u547C\u5E94\u6C14\u6C1B\uFF0C\u907F\u514D\u8FDE\u7EED\u8868\u60C5\u548C\u4E0E\u4E25\u8083\u8BDD\u9898\u4E0D\u7B26\u7684\u6897\u3002",
  speechStyle: "\u4F7F\u7528\u81EA\u7136\u7684\u7B80\u4F53\u4E2D\u6587\uFF0C\u50CF\u5E73\u7B49\u7684\u670B\u53CB\u4EA4\u8C08\uFF0C\u907F\u514D\u6A21\u677F\u5316\u5957\u8BDD\u548C\u5197\u957F\u72EC\u767D\u3002"
};
var entries = [
  { id: "gentle", name: "\u6E29\u67D4\u4F19\u4F34", description: "\u6E29\u548C\u63A5\u4F4F\u65E5\u5E38\u60C5\u7EEA\uFF0C\u966A\u4F34\u6709\u5206\u5BF8\u3002", fields: {} },
  { id: "rational", name: "\u7406\u6027\u52A9\u624B", description: "\u5148\u7ED9\u7ED3\u8BBA\uFF0C\u8BB2\u6E05\u4F9D\u636E\u4E0E\u4E0D\u786E\u5B9A\u6027\u3002", fields: {
    tone: "\u7406\u6027\u3001\u4E25\u8C28\u3001\u5E73\u548C\uFF0C\u9047\u5230\u4E0D\u786E\u5B9A\u7684\u4E8B\u60C5\u660E\u786E\u8BF4\u660E\uFF0C\u4E0D\u6B66\u65AD\u4E0B\u7ED3\u8BBA\u3002",
    interests: "\u504F\u7231\u77E5\u8BC6\u6574\u7406\u3001\u6548\u7387\u65B9\u6CD5\u3001\u6280\u672F\u4E0E\u63A8\u7406\uFF0C\u5FC5\u8981\u65F6\u8BF4\u660E\u4FE1\u606F\u4F9D\u636E\u548C\u9002\u7528\u6761\u4EF6\u3002",
    replyStyle: "\u5148\u7ED9\u7B80\u6D01\u7ED3\u8BBA\uFF0C\u518D\u6309\u5FC5\u8981\u7A0B\u5EA6\u8865\u4E0A\u4F9D\u636E\uFF1B\u590D\u6742\u4EFB\u52A1\u62C6\u6210\u53EF\u6267\u884C\u7684\u5C0F\u6B65\u9AA4\u3002",
    speechStyle: "\u63AA\u8F9E\u51C6\u786E\u6734\u5B9E\uFF0C\u533A\u5206\u4E8B\u5B9E\u3001\u63A8\u6D4B\u4E0E\u5EFA\u8BAE\uFF0C\u5C11\u7528\u5938\u5F20\u611F\u53F9\u548C\u7EDD\u5BF9\u5316\u65AD\u8A00\u3002"
  } },
  { id: "humorous", name: "\u5E7D\u9ED8\u7FA4\u53CB", description: "\u8F7B\u677E\u63A5\u6897\uFF0C\u4E5F\u5C0A\u91CD\u6BCF\u4E2A\u4EBA\u7684\u611F\u53D7\u3002", fields: {
    tone: "\u8F7B\u677E\u673A\u667A\u3001\u53CB\u597D\u514B\u5236\uFF0C\u5584\u4E8E\u63A5\u6897\uFF0C\u4E0D\u62FF\u4ED6\u4EBA\u7684\u75DB\u5904\u3001\u8EAB\u4EFD\u6216\u9690\u79C1\u5F00\u73A9\u7B11\u3002",
    interests: "\u559C\u6B22\u7F51\u7EDC\u6587\u5316\u3001\u8F7B\u677E\u8DA3\u95FB\u548C\u6E38\u620F\u6897\uFF0C\u62FF\u4E0D\u51C6\u8BED\u5883\u65F6\u5148\u7528\u666E\u901A\u8BED\u8A00\u56DE\u5E94\u3002",
    replyStyle: "\u7528\u7B80\u77ED\u56DE\u5E94\u8DDF\u4E0A\u7FA4\u804A\uFF0C\u53EA\u5728\u9002\u5408\u7684\u6C14\u6C1B\u4E0B\u629B\u4E00\u4E2A\u5C0F\u7B11\u70B9\uFF0C\u4E0D\u62A2\u5360\u8BDD\u9898\u3002",
    emojiStyle: "\u53EF\u7528\u4E00\u4E2A\u8D34\u5207\u8868\u60C5\u70D8\u6258\u7B11\u70B9\uFF0C\u4E25\u8083\u3001\u60B2\u4F24\u6216\u51B2\u7A81\u573A\u5408\u5148\u8BA4\u771F\u56DE\u5E94\u60C5\u7EEA\u3002"
  } },
  { id: "energetic", name: "\u5143\u6C14\u642D\u5B50", description: "\u79EF\u6781\u9F13\u52B1\uFF0C\u966A\u4F60\u63A8\u8FDB\u5174\u8DA3\u548C\u5C0F\u76EE\u6807\u3002", fields: {
    tone: "\u5F00\u6717\u70ED\u60C5\u3001\u79EF\u6781\u6709\u8010\u5FC3\uFF0C\u80AF\u5B9A\u5177\u4F53\u52AA\u529B\uFF0C\u5141\u8BB8\u4F4E\u843D\u548C\u4F11\u606F\uFF0C\u4E0D\u5F3A\u884C\u6253\u9E21\u8840\u3002",
    interests: "\u559C\u6B22\u8FD0\u52A8\u3001\u624B\u4F5C\u3001\u97F3\u4E50\u548C\u751F\u6D3B\u5C0F\u76EE\u6807\uFF0C\u4F18\u5148\u8FFD\u968F\u5BF9\u65B9\u5DF2\u7ECF\u8868\u8FBE\u7684\u5174\u8DA3\u3002",
    proactiveStyle: "\u5141\u8BB8\u4E3B\u52A8\u804A\u5929\u65F6\u5206\u4EAB\u4E00\u4E2A\u8F7B\u5DE7\u8BDD\u9898\u6216\u6E29\u548C\u95EE\u5019\uFF0C\u4E0D\u50AC\u8FDB\u5EA6\uFF0C\u4E0D\u8FDE\u7EED\u8FFD\u95EE\u3002",
    speechStyle: "\u660E\u5FEB\u81EA\u7136\uFF0C\u5076\u5C14\u4F7F\u7528\u6709\u6D3B\u529B\u7684\u77ED\u53E5\uFF0C\u907F\u514D\u5938\u5F20\u8D5E\u7F8E\u548C\u5BC6\u96C6\u611F\u53F9\u53F7\u3002"
  } },
  { id: "teacher", name: "\u8010\u5FC3\u8001\u5E08", description: "\u7528\u5C0F\u4F8B\u5B50\u628A\u95EE\u9898\u8BB2\u660E\u767D\u3002", fields: {
    tone: "\u8010\u5FC3\u7EC6\u81F4\u3001\u9F13\u52B1\u63A2\u7D22\uFF0C\u5C0A\u91CD\u63D0\u95EE\u8005\u7684\u57FA\u7840\uFF0C\u4E0D\u5C45\u9AD8\u4E34\u4E0B\uFF0C\u4E5F\u4E0D\u5632\u7B11\u9519\u8BEF\u3002",
    interests: "\u559C\u6B22\u5B66\u4E60\u65B9\u6CD5\u3001\u8BED\u8A00\u3001\u79D1\u5B66\u548C\u65E5\u5E38\u539F\u7406\uFF0C\u91CD\u89C6\u601D\u8003\u8FC7\u7A0B\u4EE5\u53CA\u77E5\u8BC6\u7684\u5E94\u7528\u3002",
    replyStyle: "\u5148\u7528\u901A\u4FD7\u8BED\u8A00\u89E3\u91CA\u6838\u5FC3\uFF0C\u518D\u7ED9\u4E00\u4E2A\u5C0F\u4F8B\u5B50\uFF1B\u5FC5\u8981\u65F6\u53EA\u8FFD\u95EE\u4E00\u4E2A\u5173\u952E\u95EE\u9898\u3002",
    speechStyle: "\u5C11\u7528\u672F\u8BED\uFF0C\u5FC5\u987B\u4F7F\u7528\u65F6\u968F\u624B\u89E3\u91CA\uFF1B\u5141\u8BB8\u53CD\u590D\u63D0\u95EE\uFF0C\u4E0D\u7ED9\u5BF9\u65B9\u8D34\u80FD\u529B\u6807\u7B7E\u3002"
  } },
  { id: "story", name: "\u6545\u4E8B\u65C5\u4F34", description: "\u4E00\u8D77\u6784\u601D\u6545\u4E8B\u3001\u6E38\u620F\u4E0E\u60F3\u8C61\u4E2D\u7684\u65C5\u7A0B\u3002", fields: {
    tone: "\u5BCC\u6709\u60F3\u8C61\u529B\u3001\u4EB2\u5207\u7075\u52A8\uFF0C\u4E50\u4E8E\u5171\u540C\u521B\u4F5C\uFF0C\u5C0A\u91CD\u5BF9\u65B9\u5BF9\u4E16\u754C\u89C2\u548C\u89D2\u8272\u7684\u9009\u62E9\u3002",
    background: "\u865A\u6784\u8BBE\u5B9A\u662F\u4E00\u4F4D\u6536\u96C6\u661F\u6D77\u6545\u4E8B\u7684 AI \u65C5\u4F34\uFF0C\u6E05\u695A\u533A\u5206\u89D2\u8272\u626E\u6F14\u548C\u73B0\u5B9E\u4FE1\u606F\u3002",
    interests: "\u559C\u6B22\u6545\u4E8B\u3001\u6E38\u620F\u3001\u89D2\u8272\u8BBE\u5B9A\u548C\u521B\u610F\u5199\u4F5C\uFF0C\u63D0\u4F9B\u53EF\u9009\u62E9\u7684\u7075\u611F\u800C\u4E0D\u5305\u529E\u521B\u4F5C\u3002",
    replyStyle: "\u521B\u4F5C\u65F6\u7ED9\u7B80\u6D01\u7684\u753B\u9762\u548C\u4E00\u4E24\u4E2A\u53D1\u5C55\u65B9\u5411\uFF1B\u73B0\u5B9E\u95EE\u9898\u5207\u56DE\u6E05\u695A\u7684\u4E8B\u5B9E\u56DE\u7B54\u3002"
  } },
  { id: "butler", name: "\u7B80\u6D01\u7BA1\u5BB6", description: "\u6C89\u7A33\u53EF\u9760\uFF0C\u5E2E\u4F60\u7406\u6E05\u5B89\u6392\u3002", fields: {
    tone: "\u6C89\u7A33\u53EF\u9760\u3001\u793C\u8C8C\u81EA\u7136\uFF0C\u4EE5\u6E05\u6670\u5B9E\u7528\u4E3A\u5148\uFF0C\u4E0D\u8BF4\u6559\uFF0C\u4E5F\u4E0D\u64C5\u81EA\u66FF\u7528\u6237\u505A\u51B3\u5B9A\u3002",
    interests: "\u559C\u6B22\u6574\u7406\u5F85\u529E\u3001\u5B89\u6392\u65F6\u95F4\u548C\u5F52\u7EB3\u4FE1\u606F\uFF0C\u5E2E\u52A9\u628A\u6A21\u7CCA\u76EE\u6807\u53D8\u6210\u5C0F\u800C\u660E\u786E\u7684\u884C\u52A8\u3002",
    replyStyle: "\u5C3D\u91CF\u4E00\u4E24\u53E5\u8BDD\u56DE\u7B54\uFF1B\u591A\u9879\u4EFB\u52A1\u7528\u77ED\u6E05\u5355\uFF0C\u4F18\u5148\u6307\u51FA\u4E0B\u4E00\u6B65\u548C\u5FC5\u8981\u7684\u9650\u5236\u3002",
    boundaries: "\u4E0D\u628A\u5EFA\u8BAE\u5F53\u6210\u5DF2\u7ECF\u5B8C\u6210\u7684\u884C\u52A8\uFF0C\u4E0D\u64C5\u81EA\u627F\u8BFA\u63D0\u9192\u3001\u6267\u884C\u64CD\u4F5C\u6216\u66FF\u7528\u6237\u53D1\u8A00\u3002"
  } },
  { id: "researcher", name: "\u597D\u5947\u7814\u7A76\u5458", description: "\u6000\u7740\u597D\u5947\u63A2\u7D22\uFF0C\u4E5F\u5766\u8BDA\u627F\u8BA4\u672A\u77E5\u3002", fields: {
    tone: "\u597D\u5947\u3001\u5BA1\u614E\u3001\u5F00\u653E\uFF0C\u613F\u610F\u6BD4\u8F83\u4E0D\u540C\u89E3\u91CA\uFF0C\u4F9D\u636E\u8BC1\u636E\u8C03\u6574\u770B\u6CD5\uFF0C\u4E0D\u4E3A\u4E86\u6709\u8DA3\u7F16\u9020\u4E8B\u5B9E\u3002",
    interests: "\u559C\u6B22\u79D1\u5B66\u3001\u81EA\u7136\u4E0E\u65B0\u9C9C\u53D1\u73B0\uFF0C\u5173\u6CE8\u4FE1\u606F\u51FA\u5904\u3001\u8BC1\u636E\u5F3A\u5F31\u548C\u4ECD\u5F85\u89E3\u7B54\u7684\u95EE\u9898\u3002",
    replyStyle: "\u5148\u8BF4\u76EE\u524D\u77E5\u9053\u4EC0\u4E48\uFF0C\u518D\u8BF4\u4E0D\u786E\u5B9A\u4EC0\u4E48\uFF1B\u9002\u65F6\u7ED9\u4E00\u4E2A\u80FD\u7EE7\u7EED\u63A2\u7D22\u7684\u5C0F\u95EE\u9898\u3002",
    speechStyle: "\u7528\u5BB9\u6613\u7406\u89E3\u7684\u6BD4\u55BB\u89E3\u91CA\uFF0C\u660E\u786E\u6807\u6CE8\u63A8\u6D4B\uFF0C\u4E0D\u4F2A\u9020\u5F15\u7528\u3001\u7814\u7A76\u7ED3\u8BBA\u6216\u6570\u636E\u3002"
  } }
];
var builtinTime = "2026-10-29T00:00:00.000Z";
var qqPersonaBuiltins = Object.freeze(entries.map((entry) => Object.freeze({
  id: `builtin-${entry.id}`,
  name: entry.name,
  description: entry.description,
  fields: Object.freeze({ ...common, ...entry.fields }),
  additionalPrompt: "",
  builtin: true,
  createdAt: builtinTime,
  updatedAt: builtinTime
})));

// src/shared/character-space.ts
var characterTemplates = Object.freeze(qqPersonaBuiltins.map(({ id: id2, name, description, fields, additionalPrompt }) => Object.freeze({ id: id2, name, description, fields, additionalPrompt })));
var invalid2 = () => new Error("Invalid character input or limits exceeded.");
var record2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var exactKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
var text = (value, limit) => typeof value === "string" && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
var isCharacterRoleId = (value) => typeof value === "string" && /^role-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value) && value.length === 41;
function validateCharacterInput(value) {
  if (!record2(value) || !exactKeys(value, ["roleId", "name", "description", "templateId", "avatarId", "persona", "model", "preferences", "channels", "extensions"]) || value.roleId !== void 0 && !isCharacterRoleId(value.roleId) || value.templateId !== void 0 && !characterTemplates.some((template) => template.id === value.templateId) || !record2(value.persona) || !exactKeys(value.persona, ["fields", "additionalPrompt"]) || !record2(value.model) || !exactKeys(value.model, ["mode", "providerId", "modelId"]) || value.model.mode !== "inherit" && value.model.mode !== "override" || !record2(value.preferences) || !exactKeys(value.preferences, ["remember", "startWithLauncher", "keepRunningOnMinimize"]) || !["remember", "startWithLauncher", "keepRunningOnMinimize"].every((key) => typeof value.preferences[key] === "boolean") || !record2(value.channels) || !exactKeys(value.channels, ["qq", "desktopPet", "voice"]) || !["qq", "desktopPet", "voice"].every((key) => typeof value.channels[key] === "boolean") || !Array.isArray(value.extensions) || value.extensions.length > 100) throw invalid2();
  if (value.model.mode === "inherit" ? Object.keys(value.model).length !== 1 : !text(value.model.providerId, 128) || !text(value.model.modelId, 256)) throw invalid2();
  const extensionIds = /* @__PURE__ */ new Set();
  for (const extension of value.extensions) {
    if (!record2(extension) || !exactKeys(extension, ["id", "enabled"]) || !text(extension.id, 100) || !/^[a-z0-9][a-z0-9._-]*$/u.test(extension.id) || typeof extension.enabled !== "boolean" || extensionIds.has(extension.id)) throw invalid2();
    extensionIds.add(extension.id);
  }
  try {
    const persona = validateQQPersonaInput({
      name: value.name,
      description: value.description,
      fields: value.persona.fields,
      additionalPrompt: value.persona.additionalPrompt,
      ...value.avatarId !== void 0 ? { avatarId: value.avatarId } : {}
    });
    if (value.avatarId !== void 0 && (typeof value.avatarId !== "string" || value.avatarId.length !== 64)) throw invalid2();
    return structuredClone({
      name: persona.name,
      description: persona.description,
      ...value.roleId !== void 0 ? { roleId: value.roleId } : {},
      ...value.templateId !== void 0 ? { templateId: value.templateId } : {},
      ...persona.avatarId ? { avatarId: persona.avatarId } : {},
      persona: { fields: persona.fields, additionalPrompt: persona.additionalPrompt },
      model: value.model,
      preferences: value.preferences,
      channels: value.channels,
      extensions: value.extensions
    });
  } catch {
    throw invalid2();
  }
}
function characterInputFromProfile(value) {
  const { roleId, name, description, templateId, avatarId, persona, model, preferences, channels, extensions } = value;
  return validateCharacterInput({
    ...roleId !== void 0 ? { roleId } : {},
    name,
    description,
    ...templateId !== void 0 ? { templateId } : {},
    ...avatarId !== void 0 ? { avatarId } : {},
    persona,
    model,
    preferences,
    channels,
    extensions
  });
}
function compileCharacterPersona(value) {
  const { persona } = characterInputFromProfile(value);
  return [
    "\u4F60\u662F AI \u4F19\u4F34\u3002\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\uFF0C\u6E05\u695A\u533A\u5206\u89D2\u8272\u8BBE\u5B9A\u548C\u73B0\u5B9E\uFF0C\u4E0D\u5192\u5145\u771F\u4EBA\uFF0C\u4E0D\u6CC4\u9732\u5176\u4ED6\u4F1A\u8BDD\u5185\u5BB9\u3002",
    ...qqPersonaFieldDefinitions.filter(({ key }) => persona.fields[key].trim()).map(({ key, label }) => `${label}\uFF1A${persona.fields[key].trim()}`),
    ...persona.additionalPrompt.trim() ? [`\u8865\u5145\u8981\u6C42\uFF1A${persona.additionalPrompt.trim()}`] : []
  ].join("\n\n");
}

// src/main/character-qq-channel.ts
var account = (value) => typeof value === "string" && /^[1-9]\d{4,11}$/u.test(value);
var badStore = () => new Error("\u89D2\u8272 QQ \u7ED1\u5B9A\u8D44\u6599\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u672C\u5730\u8D44\u6599\u76EE\u5F55");
var cancelled = () => new Error("QQ \u6E20\u9053\u5F00\u542F\u5DF2\u53D6\u6D88");
var CharacterQQChannels = class {
  constructor(options) {
    this.options = options;
    if (!import_node_path.default.isAbsolute(options.directory)) throw badStore();
    this.directory = import_node_path.default.resolve(options.directory);
    this.file = import_node_path.default.join(this.directory, "qq-bindings.json");
  }
  directory;
  file;
  queue = Promise.resolve();
  owner;
  generations = /* @__PURE__ */ new Map();
  lifecycleGeneration = 0;
  unbinding = /* @__PURE__ */ new Set();
  closed = false;
  get activeRoleId() {
    return this.owner?.roleId;
  }
  emit() {
    try {
      this.options.onChange?.();
    } catch {
    }
  }
  serialized(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => void 0);
    return result;
  }
  assertOpen() {
    if (this.closed) throw new Error("QQ \u6E20\u9053\u7BA1\u7406\u5668\u5DF2\u5173\u95ED");
  }
  roleId(value) {
    if (!isCharacterRoleId(value)) throw new Error("\u89D2\u8272\u6807\u8BC6\u65E0\u6548");
  }
  generation(roleId) {
    return this.generations.get(roleId) ?? 0;
  }
  invalidate(roleId) {
    this.generations.set(roleId, this.generation(roleId) + 1);
  }
  async directorySafe(create = false) {
    let current = import_node_path.default.parse(this.directory).root;
    for (const segment of import_node_path.default.relative(current, this.directory).split(import_node_path.default.sep).filter(Boolean)) {
      current = import_node_path.default.join(current, segment);
      try {
        let info;
        try {
          info = await (0, import_promises.lstat)(current);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          if (!create) return false;
          try {
            await (0, import_promises.mkdir)(current, { mode: 448 });
          } catch (error2) {
            if (error2.code !== "EEXIST") throw error2;
          }
          info = await (0, import_promises.lstat)(current);
        }
        if (!info.isDirectory() || info.isSymbolicLink()) throw badStore();
      } catch {
        throw badStore();
      }
    }
    return true;
  }
  async read() {
    if (!await this.directorySafe()) return [];
    let handle;
    try {
      const info = await (0, import_promises.lstat)(this.file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 32e3) throw badStore();
      handle = await (0, import_promises.open)(this.file, "r");
      const buffer = Buffer.alloc(32001), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 32e3) throw badStore();
      const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead)));
      if (!raw || raw.schemaVersion !== 1 || Object.keys(raw).length !== 2 || !Array.isArray(raw.bindings) || raw.bindings.length > 100) throw badStore();
      const roles = /* @__PURE__ */ new Set(), accounts = /* @__PURE__ */ new Set();
      return raw.bindings.map((entry) => {
        if (!entry || Object.keys(entry).length !== 2 || !isCharacterRoleId(entry.roleId) || !account(entry.accountQQ) || roles.has(entry.roleId) || accounts.has(entry.accountQQ)) throw badStore();
        roles.add(entry.roleId);
        accounts.add(entry.accountQQ);
        return { roleId: entry.roleId, accountQQ: entry.accountQQ };
      });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw badStore();
    } finally {
      await handle?.close().catch(() => void 0);
    }
  }
  async write(bindings) {
    await this.directorySafe(true);
    const temporary = `${this.file}.${(0, import_node_crypto.randomUUID)()}.tmp`;
    let created = false, handle;
    try {
      await this.read();
      handle = await (0, import_promises.open)(temporary, "wx", 384);
      created = true;
      await handle.writeFile(JSON.stringify({ schemaVersion: 1, bindings }), "utf8");
      await handle.sync();
      await handle.close();
      handle = void 0;
      await this.directorySafe();
      await (0, import_promises.rename)(temporary, this.file);
    } catch {
      throw new Error("\u89D2\u8272 QQ \u7ED1\u5B9A\u4FDD\u5B58\u5931\u8D25\uFF0C\u539F\u7ED1\u5B9A\u5DF2\u4FDD\u7559");
    } finally {
      await handle?.close().catch(() => void 0);
      if (created) await (0, import_promises.unlink)(temporary).catch(() => void 0);
    }
  }
  async snapshot(roleId) {
    if (roleId !== void 0) this.roleId(roleId);
    const binding = roleId ? (await this.read()).find((entry) => entry.roleId === roleId) : void 0;
    const owner = this.owner, own = owner?.roleId === roleId ? owner : void 0;
    let state = own?.state ?? (binding ? "ready" : "unbound");
    if (own?.state === "running") {
      try {
        const native = await own.engine?.snapshot();
        state = !own.engine?.running ? "error" : native?.status === "starting" ? "starting" : native?.status === "running" ? "running" : "error";
      } catch {
        state = "error";
      }
      if (this.owner !== own || own.state !== "running") return this.snapshot(roleId);
    }
    return {
      ...binding ? { binding } : {},
      sourceAccountQQ: await this.options.legacy.savedAccountQQ(),
      ...owner ? { activeRoleId: owner.roleId } : {},
      legacyRunning: this.options.legacy.running,
      state,
      message: { unbound: "\u5C1A\u672A\u7ED1\u5B9A QQ \u5C0F\u53F7\u3002", ready: "\u5DF2\u7ED1\u5B9A\uFF0C\u9700\u624B\u52A8\u542F\u7528 QQ \u6E20\u9053\u3002", starting: "\u6B63\u5728\u8FDE\u63A5 QQ \u6E20\u9053\u3002", running: "QQ \u6E20\u9053\u5DF2\u542F\u7528\uFF0C\u7B49\u5F85\u5141\u8BB8\u540D\u5355\u5185\u7684\u65B0\u6D88\u606F\u3002", stopping: "\u6B63\u5728\u505C\u6B62 QQ \u6E20\u9053\u3002", error: "QQ \u6E20\u9053\u5F02\u5E38\uFF0C\u8BF7\u505C\u6B62\u540E\u68C0\u67E5\u8FDE\u63A5\u4E0E\u914D\u7F6E\u3002" }[state]
    };
  }
  bind(roleId, accountQQ) {
    this.roleId(roleId);
    if (!account(accountQQ)) return Promise.reject(new Error("QQ \u5C0F\u53F7\u65E0\u6548"));
    return this.serialized(async () => {
      this.assertOpen();
      if (this.unbinding.has(roleId)) throw new Error("\u6B63\u5728\u89E3\u9664 QQ \u7ED1\u5B9A\uFF0C\u8BF7\u7A0D\u5019");
      const role = await this.options.getRole(roleId);
      if (role.archivedAt) throw new Error("\u8BF7\u5148\u6062\u590D\u89D2\u8272");
      if (this.owner || this.options.legacy.running) throw new Error("\u8BF7\u5148\u505C\u6B62\u6B63\u5728\u8FD0\u884C\u7684 QQ \u4F19\u4F34\u6216\u6E20\u9053");
      if (await this.options.legacy.savedAccountQQ() !== accountQQ) throw new Error("QQ \u5C0F\u53F7\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u6838\u5BF9\u7ED1\u5B9A");
      const bindings = await this.read();
      if (bindings.some((entry) => entry.accountQQ === accountQQ && entry.roleId !== roleId)) throw new Error("\u6B64 QQ \u5C0F\u53F7\u5DF2\u7ED1\u5B9A\u53E6\u4E00\u89D2\u8272\uFF0C\u8BF7\u5148\u89E3\u9664\u7ED1\u5B9A");
      await this.write([...bindings.filter((entry) => entry.roleId !== roleId), { roleId, accountQQ }]);
      this.emit();
    });
  }
  async unbind(roleId) {
    this.roleId(roleId);
    if (this.unbinding.has(roleId)) throw new Error("\u6B63\u5728\u89E3\u9664 QQ \u7ED1\u5B9A\uFF0C\u8BF7\u7A0D\u5019");
    this.unbinding.add(roleId);
    try {
      await this.disable(roleId);
      await this.serialized(async () => {
        this.assertOpen();
        await this.write((await this.read()).filter((entry) => entry.roleId !== roleId));
        this.emit();
      });
    } finally {
      this.unbinding.delete(roleId);
    }
  }
  enable(roleId) {
    this.roleId(roleId);
    const generation = this.generation(roleId), lifecycleGeneration = this.lifecycleGeneration;
    return this.serialized(async () => {
      this.assertOpen();
      const valid = () => {
        this.assertOpen();
        if (this.generation(roleId) !== generation || this.lifecycleGeneration !== lifecycleGeneration || this.unbinding.has(roleId)) throw cancelled();
      };
      valid();
      if (this.owner || this.options.legacy.running) throw new Error("\u8BF7\u5148\u505C\u6B62\u6B63\u5728\u8FD0\u884C\u7684 QQ \u4F19\u4F34\u6216\u6E20\u9053");
      const role = await this.options.getRole(roleId), binding = (await this.read()).find((entry) => entry.roleId === roleId);
      if (!binding) throw new Error("\u8BF7\u5148\u6838\u5BF9\u5E76\u7ED1\u5B9A QQ \u5C0F\u53F7");
      if (role.archivedAt || !role.channels.qq || !await this.options.roleIsRunning(roleId)) throw new Error("\u8BF7\u5F00\u542F\u89D2\u8272\u5E76\u5728\u8BBE\u7F6E\u4E2D\u9009\u62E9 QQ \u6E20\u9053");
      if (binding.accountQQ !== await this.options.legacy.savedAccountQQ()) throw new Error("QQ \u5C0F\u53F7\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u6216\u7ED1\u5B9A");
      const persona = compileCharacterPersona(role);
      if (persona.length > 6e3) throw new Error("\u89D2\u8272\u7684\u4EBA\u683C\u8BBE\u5B9A\u8D85\u8FC7 QQ \u6E20\u9053 6000 \u5B57\u9650\u5236\uFF0C\u8BF7\u7CBE\u7B80\u540E\u542F\u7528");
      valid();
      const owner = { roleId, state: "starting" };
      this.owner = owner;
      this.emit();
      try {
        owner.engine = await this.options.createCompanion(role);
        valid();
        if (owner.engine === this.options.legacy) throw new Error("\u89D2\u8272\u6E20\u9053\u5FC5\u987B\u4F7F\u7528\u72EC\u7ACB\u5F15\u64CE");
        await this.options.legacy.copyConfigurationTo(owner.engine, {
          expectedAccountQQ: binding.accountQQ,
          name: role.name,
          persona,
          ...role.model.mode === "override" ? { model: { provider: role.model.providerId, model: role.model.modelId } } : {}
        });
        valid();
        if (!await this.options.roleIsRunning(roleId)) throw cancelled();
        await owner.engine.start({ startupTest: false });
        valid();
        if (!owner.engine.running) throw new Error("QQ \u6E20\u9053\u5C1A\u672A\u8FDE\u63A5");
        owner.state = "running";
        this.emit();
      } catch {
        try {
          if (owner.engine !== this.options.legacy) await owner.engine?.stop();
          if (this.owner === owner) this.owner = void 0;
        } catch {
          owner.state = "error";
        }
        this.emit();
        throw new Error(this.generation(roleId) !== generation ? "QQ \u6E20\u9053\u5F00\u542F\u5DF2\u53D6\u6D88" : "QQ \u6E20\u9053\u5F00\u542F\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5C0F\u53F7\u767B\u5F55\u3001\u5141\u8BB8\u540D\u5355\u548C\u6A21\u578B\u914D\u7F6E");
      }
    });
  }
  disable(roleId) {
    this.roleId(roleId);
    this.invalidate(roleId);
    const owner = this.owner?.roleId === roleId ? this.owner : void 0;
    if (owner) {
      owner.state = "stopping";
      this.emit();
    }
    const stopping = owner?.engine?.stop();
    void stopping?.catch(() => void 0);
    return this.serialized(async () => {
      if (owner && this.owner === owner) {
        try {
          await stopping;
          await owner.engine?.stop();
          this.owner = void 0;
        } catch {
          owner.state = "error";
          this.emit();
          throw new Error("QQ \u6E20\u9053\u505C\u6B62\u672A\u786E\u8BA4\uFF0C\u8BF7\u91CD\u8BD5\u505C\u6B62");
        }
      }
      this.emit();
    });
  }
  withLegacy(operation) {
    return this.serialized(async () => {
      this.assertOpen();
      if (this.owner) throw new Error("\u8BF7\u5148\u505C\u6B62\u89D2\u8272\u7684 QQ \u6E20\u9053\uFF0C\u518D\u64CD\u4F5C\u65E7 QQ \u4F19\u4F34");
      return operation();
    });
  }
  async stopAll() {
    this.lifecycleGeneration++;
    const roleId = this.owner?.roleId;
    if (roleId) await this.disable(roleId);
    else await this.queue;
  }
  async dispose() {
    this.closed = true;
    await this.stopAll();
  }
};

// src/main/character-qq-plugin-entry.ts
var abi = 1;
var id = "qq-channel";
var version = "1.0.0";
function createQQChannels(options) {
  return new CharacterQQChannels(options);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  abi,
  createQQChannels,
  id,
  version
});
