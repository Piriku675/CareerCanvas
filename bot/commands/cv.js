/**
 * commands/cv.js
 * Handles CV timeline and skills section management.
 */

const { db }                           = require("../utils/firebase");
const { cvEntryActions, skillGroupActions, backMain } = require("../utils/keyboards");
const { setState }                     = require("../utils/state");
const admin                            = require("firebase-admin");

// ══════════════════════════════════════════════════════════════
//  TIMELINE ENTRIES
// ══════════════════════════════════════════════════════════════

async function listCvEntries(bot, chatId) {
  const snap = await db.collection("cv").orderBy("order").get();

  const buttons = snap.docs.map(doc => {
    const d = doc.data();
    return [{ text: `📅  ${d.title} — ${d.period}`, callback_data: `cv_item_${doc.id}` }];
  });

  buttons.push([{ text: "➕ Add experience",  callback_data: "cv_add_new"  }]);
  buttons.push([{ text: "⬅️ Main Menu",        callback_data: "menu_main"  }]);

  await bot.sendMessage(chatId, "💼 *Work Experience*", {
    parse_mode:   "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function showCvEntry(bot, chatId, entryId, msgId) {
  const doc = await db.collection("cv").doc(entryId).get();
  if (!doc.exists) return bot.sendMessage(chatId, "Entry not found.");
  const d = doc.data();

  const text =
    `*${d.title}*\n` +
    `Period: \`${d.period}\`\n` +
    `Place: ${d.place}\n` +
    `Desc: ${d.description ? d.description.slice(0, 100) + "…" : "—"}`;

  const opts = { parse_mode: "Markdown", reply_markup: cvEntryActions(entryId) };
  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts });
  else       await bot.sendMessage(chatId, text, opts);
}

async function startAddCvEntry(bot, chatId) {
  const snap  = await db.collection("cv").get();
  const order = snap.size + 1;
  const newId = `cv-${String(order).padStart(2, "0")}-${Date.now()}`;

  await db.collection("cv").doc(newId).set({
    order,
    period:      "2024 – Present",
    title:       "New Role",
    place:       "Company Name",
    description: "",
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  });

  await bot.sendMessage(chatId, `✅ New entry created.\nNow send the *job title*:`, { parse_mode: "Markdown" });
  setState(chatId, "cv_edit_title", { entryId: newId });
}

async function updateCvField(bot, chatId, entryId, field, value) {
  await db.collection("cv").doc(entryId).update({
    [field]:   value,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Updated *${field}*`, {
    parse_mode:   "Markdown",
    reply_markup: cvEntryActions(entryId),
  });
}

async function deleteCvEntry(bot, chatId, entryId) {
  await db.collection("cv").doc(entryId).delete();
  await bot.sendMessage(chatId, "🗑 Entry deleted.", { reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_cv' }, { text: '🏠 Main Menu', callback_data: 'menu_main' }]] } });
}

// ══════════════════════════════════════════════════════════════
//  SKILLS
// ══════════════════════════════════════════════════════════════

async function listSkillGroups(bot, chatId) {
  const snap = await db.collection("skills").orderBy("order").get();

  const buttons = snap.docs.map(doc => {
    const d = doc.data();
    return [{ text: `🛠  ${d.label}  (${d.skills.length} skills)`, callback_data: `skill_group_${doc.id}` }];
  });

  buttons.push([{ text: "➕ Add skill group", callback_data: "skill_add_group" }]);
  buttons.push([{ text: "⬅️ Main Menu",       callback_data: "menu_main"       }]);

  await bot.sendMessage(chatId, "🛠 *Skills*", {
    parse_mode:   "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function showSkillGroup(bot, chatId, groupId, msgId) {
  const doc = await db.collection("skills").doc(groupId).get();
  if (!doc.exists) return bot.sendMessage(chatId, "Group not found.");
  const d = doc.data();
  const list = d.skills.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  const text = `*${d.label}*\n\n${list || "(empty)"}`;
  const opts = { parse_mode: "Markdown", reply_markup: skillGroupActions(groupId) };
  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts });
  else       await bot.sendMessage(chatId, text, opts);
}

async function addSkillToGroup(bot, chatId, groupId, skillName) {
  await db.collection("skills").doc(groupId).update({
    skills:    admin.firestore.FieldValue.arrayUnion(skillName),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Added *${skillName}* to group.`, {
    parse_mode:   "Markdown",
    reply_markup: skillGroupActions(groupId),
  });
}

async function removeSkillFromGroup(bot, chatId, groupId, skillName) {
  await db.collection("skills").doc(groupId).update({
    skills:    admin.firestore.FieldValue.arrayRemove(skillName),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Removed *${skillName}*.`, {
    parse_mode:   "Markdown",
    reply_markup: skillGroupActions(groupId),
  });
}

async function renameSkillGroup(bot, chatId, groupId, newLabel) {
  await db.collection("skills").doc(groupId).update({
    label:     newLabel,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Group renamed to *${newLabel}*.`, {
    parse_mode:   "Markdown",
    reply_markup: skillGroupActions(groupId),
  });
}

async function deleteSkillGroup(bot, chatId, groupId) {
  await db.collection("skills").doc(groupId).delete();
  await bot.sendMessage(chatId, "🗑 Skill group deleted.", { reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu_cv' }, { text: '🏠 Main Menu', callback_data: 'menu_main' }]] } });
}

async function addSkillGroup(bot, chatId, label) {
  const snap  = await db.collection("skills").get();
  const order = snap.size + 1;
  const newId = `skills-${Date.now()}`;
  await db.collection("skills").doc(newId).set({
    order,
    label,
    skills:    [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Created group *${label}*. Now use "Add skill" to populate it.`, {
    parse_mode:   "Markdown",
    reply_markup: skillGroupActions(newId),
  });
}

module.exports = {
  listCvEntries,
  showCvEntry,
  startAddCvEntry,
  updateCvField,
  deleteCvEntry,
  listSkillGroups,
  showSkillGroup,
  addSkillToGroup,
  removeSkillFromGroup,
  renameSkillGroup,
  deleteSkillGroup,
  addSkillGroup,
};
