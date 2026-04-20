/**
 * commands/categories.js
 * Dynamic portfolio category management.
 */

const { db }       = require("../utils/firebase");
const { setState } = require("../utils/state");
const admin        = require("firebase-admin");

function backToCats() {
  return { inline_keyboard: [[{ text: "⬅️ Back to Categories", callback_data: "menu_categories" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] };
}

async function listCategories(bot, chatId) {
  const snap = await db.collection("categories").orderBy("order").get();
  const buttons = snap.docs.map(doc => {
    const d = doc.data();
    return [{ text: `🏷  ${d.label}  [${d.slug}]`, callback_data: `cat_item_${doc.id}` }];
  });
  buttons.push([{ text: "➕ Add category",  callback_data: "cat_add_new"  }]);
  buttons.push([{ text: "⬅️ Main Menu",     callback_data: "menu_main"   }]);
  await bot.sendMessage(chatId, "🏷 *Portfolio Categories*\nTap a category to edit or delete it.", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function showCategory(bot, chatId, catId) {
  const docSnap = await db.collection("categories").doc(catId).get();
  if (!docSnap.exists) return bot.sendMessage(chatId, "Category not found.", { reply_markup: backToCats() });
  const d = docSnap.data();
  await bot.sendMessage(chatId, `🏷 *${d.label}*\nSlug: \`${d.slug}\`\n\nThe slug is used as the filter ID on the site.`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Edit label", callback_data: `cat_edit_label_${catId}` }, { text: "✏️ Edit slug", callback_data: `cat_edit_slug_${catId}` }],
        [{ text: "🗑 Delete",     callback_data: `cat_delete_${catId}`      }],
        [{ text: "⬅️ Back to Categories", callback_data: "menu_categories" }, { text: "🏠 Main Menu", callback_data: "menu_main" }],
      ],
    },
  });
}

async function addCategory(bot, chatId, label) {
  const slug  = label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const snap  = await db.collection("categories").get();
  const order = snap.size + 1;
  const newId = `cat-${slug}-${Date.now()}`;
  await db.collection("categories").doc(newId).set({
    label, slug, order, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bot.sendMessage(chatId, `✅ Category *${label}* added with slug \`${slug}\`.`, {
    parse_mode: "Markdown", reply_markup: backToCats(),
  });
}

async function updateCategoryField(bot, chatId, catId, field, value) {
  const data = { [field]: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  // Auto-generate slug from label if editing label
  if (field === "label") data.slug = value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  await db.collection("categories").doc(catId).update(data);
  await bot.sendMessage(chatId, `✅ Category *${field}* updated.`, {
    parse_mode: "Markdown", reply_markup: backToCats(),
  });
}

async function deleteCategory(bot, chatId, catId) {
  await db.collection("categories").doc(catId).delete();
  await bot.sendMessage(chatId, "🗑 Category deleted.", { reply_markup: backToCats() });
}

module.exports = { listCategories, showCategory, addCategory, updateCategoryField, deleteCategory };
