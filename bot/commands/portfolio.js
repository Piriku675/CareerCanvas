/**
 * commands/portfolio.js
 * Portfolio section — uses external image URLs (no Firebase Storage).
 */

const { db }                     = require("../utils/firebase");
const { portfolioItemActions, backMain } = require("../utils/keyboards");
const { setState }               = require("../utils/state");
const admin                      = require("firebase-admin");

const COLLECTION = "portfolio";

function backToPortfolio() {
  return { inline_keyboard: [[{ text: "⬅️ Back to Portfolio", callback_data: "menu_portfolio" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] };
}

async function listPortfolio(bot, chatId) {
  const snap = await db.collection(COLLECTION).orderBy("order").get();

  if (snap.empty) {
    return bot.sendMessage(chatId, "No portfolio items yet.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Add new project", callback_data: "port_add_new" }],
          [{ text: "⬅️ Main Menu",       callback_data: "menu_main"   }],
        ],
      },
    });
  }

  const buttons = snap.docs.map(doc => {
    const d   = doc.data();
    const vis = d.visible === false ? "🙈" : "👁";
    return [{ text: `${vis}  ${d.title}  [${d.category}]`, callback_data: `port_item_${doc.id}` }];
  });
  buttons.push([{ text: "➕ Add new project", callback_data: "port_add_new" }]);
  buttons.push([{ text: "⬅️ Main Menu",       callback_data: "menu_main"   }]);

  await bot.sendMessage(chatId, "📁 *Portfolio Projects*\nTap a project to edit it.", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function showItem(bot, chatId, itemId, msgId) {
  const doc = await db.collection(COLLECTION).doc(itemId).get();
  if (!doc.exists) return bot.sendMessage(chatId, "Item not found.", { reply_markup: backToPortfolio() });

  const d       = doc.data();
  const vis     = d.visible === false ? "Hidden 🙈" : "Visible 👁";
  const hasImage = d.imageUrl ? `✅ ${d.imageUrl.slice(0, 40)}…` : "❌ Not set";
  const hasVideo = d.videoUrl ? `✅ ${d.videoUrl}` : "❌ Not set";

  const text =
    `*${d.title}*\n` +
    `Category: \`${d.category}\`\n` +
    `Image URL: ${hasImage}\n` +
    `Video: ${hasVideo}\n` +
    `Link: ${d.link || "—"}\n` +
    `Description: ${d.description ? d.description.slice(0, 80) + "…" : "—"}\n` +
    `Status: ${vis}`;

  const opts = { parse_mode: "Markdown", reply_markup: portfolioItemActions(itemId) };
  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts }).catch(() => bot.sendMessage(chatId, text, opts));
  else       await bot.sendMessage(chatId, text, opts);
}

async function startAddProject(bot, chatId) {
  const snap  = await db.collection(COLLECTION).get();
  const order = snap.size + 1;
  const newId = `proj-${String(order).padStart(2, "0")}-${Date.now()}`;

  await db.collection(COLLECTION).doc(newId).set({
    order, title: "New Project", category: "branding",
    imageUrl: "", videoUrl: "", description: "", link: "", visible: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  setState(chatId, "port_edit_title", { itemId: newId });
  await bot.sendMessage(chatId, `✅ New project created.\n\nNow send the *project title*:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: `port_item_${newId}` }]] },
  });
}

async function updateField(bot, chatId, itemId, field, value) {
  await db.collection(COLLECTION).doc(itemId).update({
    [field]: value, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ *${field}* updated.`, {
    parse_mode:   "Markdown",
    reply_markup: portfolioItemActions(itemId),
  });
}

async function toggleVisibility(bot, chatId, itemId, msgId) {
  const docSnap = await db.collection(COLLECTION).doc(itemId).get();
  const current = docSnap.data().visible !== false;
  await db.collection(COLLECTION).doc(itemId).update({ visible: !current, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await showItem(bot, chatId, itemId, msgId);
}

async function deleteItem(bot, chatId, itemId) {
  await db.collection(COLLECTION).doc(itemId).delete();
  await bot.sendMessage(chatId, "🗑 Project deleted.", { reply_markup: backToPortfolio() });
}

module.exports = { listPortfolio, showItem, startAddProject, updateField, toggleVisibility, deleteItem };
