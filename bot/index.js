/**
 * index.js — CareerCanvas Portfolio Admin Bot
 */

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express     = require("express");

const portfolio  = require("./commands/portfolio");
const cv         = require("./commands/cv");
const sections   = require("./commands/sections");
const categories = require("./commands/categories");
const { mainMenu, backMain } = require("./utils/keyboards");
const { getState, setState, clearState } = require("./utils/state");
const { db }     = require("./utils/firebase");
const admin      = require("firebase-admin");

const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_CHAT_ID);
if (!TOKEN)    throw new Error("Missing TELEGRAM_BOT_TOKEN");
if (!ADMIN_ID) throw new Error("Missing ADMIN_CHAT_ID");

const bot = new TelegramBot(TOKEN, { polling: true });
bot.on("polling_error", err => console.error("Polling error:", err.message));

function isAdmin(msg) { return String(msg.chat?.id || msg.from?.id) === ADMIN_ID; }

// ─── Retry helper ─────────────────────────────────────────────────────────────
// Re-sets state and asks again instead of dropping the flow
async function retryInput(bot, chatId, action, meta, errorMsg, promptMsg) {
  setState(chatId, action, meta);
  await bot.sendMessage(chatId,
    `❌ ${errorMsg}\n\n✏️ ${promptMsg}`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "menu_main" }]] } }
  );
}

// ─── /help content ────────────────────────────────────────────────────────────
const HELP_TEXT =
`📖 *CareerCanvas Bot Guide*

*Commands*
/start — Open main menu
/menu  — Return to main menu
/goto  — Quick-jump to any section
/cancel — Cancel current input

*Sections*
🖼 *Portfolio* — Add/edit/delete projects. Set image URL (external link), YouTube video URL, project link, description, category, visibility.
👤 *About* — Edit bio paragraphs, stats, profile photo URL.
🦸 *Hero* — Edit name, tagline, subtitle, CTA buttons, nav logo URL.
💼 *Experience* — Add/edit/delete CV timeline entries.
🛠 *Skills* — Manage skill groups and individual skills.
📬 *Contact* — Email, CV URL, social links.
🎨 *Colors* — All 13 color variables including text and nav scroll colors. Reset to defaults anytime.
🏷 *Categories* — Add/edit/delete portfolio filter categories dynamically.
⚙️ *Settings* — Site title, description, portfolio header name, favicon URL, CV file type.

*Tips*
• Image URLs must be direct links to an image file (ending in .jpg, .png, etc.)
• Recommended portfolio image size: *1200 × 900px (4:3 ratio)*
• YouTube videos are auto-embedded — just paste the full URL
• Hex colors must be in format \`#RRGGBB\` e.g. \`#C8441B\`
• Portfolio name (header) is separate from owner name — set it in ⚙️ Settings
• If you make a mistake, just tap the field again to overwrite it`;

// ─── Quick-jump menu ──────────────────────────────────────────────────────────
function gotoMenu() {
  return {
    inline_keyboard: [
      [{ text: "🖼 Portfolio",   callback_data: "menu_portfolio"  }, { text: "👤 About",      callback_data: "menu_about"      }],
      [{ text: "🦸 Hero",        callback_data: "menu_hero"       }, { text: "💼 Experience", callback_data: "menu_cv"         }],
      [{ text: "🛠 Skills",      callback_data: "menu_skills"     }, { text: "📬 Contact",    callback_data: "menu_contact"    }],
      [{ text: "🎨 Colors",      callback_data: "menu_colors"     }, { text: "🏷 Categories", callback_data: "menu_categories" }],
      [{ text: "⚙️ Settings",   callback_data: "menu_settings"   }],
    ],
  };
}

// ─── Commands ─────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async msg => {
  if (!isAdmin(msg)) return;
  clearState(msg.chat.id);
  await bot.sendMessage(msg.chat.id, `👋 *CareerCanvas Admin*\n\nWhat would you like to manage?`, { parse_mode: "Markdown", reply_markup: mainMenu() });
});
bot.onText(/\/menu/, async msg => {
  if (!isAdmin(msg)) return;
  clearState(msg.chat.id);
  await bot.sendMessage(msg.chat.id, "📋 *Main Menu*", { parse_mode: "Markdown", reply_markup: mainMenu() });
});
bot.onText(/\/goto/, async msg => {
  if (!isAdmin(msg)) return;
  await bot.sendMessage(msg.chat.id, "⚡ *Jump to section:*", { parse_mode: "Markdown", reply_markup: gotoMenu() });
});
bot.onText(/\/cancel/, async msg => {
  clearState(msg.chat.id);
  await bot.sendMessage(msg.chat.id, "❌ Cancelled.", { reply_markup: mainMenu() });
});
bot.onText(/\/help/, async msg => {
  if (!isAdmin(msg)) return;
  await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "⬅️ Main Menu", callback_data: "menu_main" }]] } });
});

// ─── Callback router ──────────────────────────────────────────────────────────
bot.on("callback_query", async query => {
  if (String(query.from.id) !== ADMIN_ID) return;
  const chatId = query.message.chat.id;
  const msgId  = query.message.message_id;
  const data   = query.data;
  await bot.answerCallbackQuery(query.id).catch(()=>{});

  if (data === "noop") return;

  // Main menu
  if (data === "menu_main")   { clearState(chatId); return bot.sendMessage(chatId, "📋 *Main Menu*", { parse_mode:"Markdown", reply_markup: mainMenu() }); }
  if (data === "cancel")      { clearState(chatId); return bot.sendMessage(chatId, "❌ Cancelled.", { reply_markup: mainMenu() }); }
  if (data === "menu_help")   return bot.sendMessage(chatId, HELP_TEXT, { parse_mode:"Markdown", reply_markup:{ inline_keyboard:[[{text:"⬅️ Main Menu",callback_data:"menu_main"}]]} });

  // Sections
  if (data === "menu_portfolio")  return portfolio.listPortfolio(bot, chatId);
  if (data === "menu_about")      return sections.showAbout(bot, chatId);
  if (data === "menu_hero")       return sections.showHero(bot, chatId);
  if (data === "menu_cv")         return cv.listCvEntries(bot, chatId);
  if (data === "menu_skills")     return cv.listSkillGroups(bot, chatId);
  if (data === "menu_contact")    return sections.showContact(bot, chatId);
  if (data === "menu_colors")     return sections.showColors(bot, chatId);
  if (data === "menu_settings")   return sections.showSettings(bot, chatId);
  if (data === "menu_categories") return categories.listCategories(bot, chatId);

  // ── Categories ─────────────────────────────────────────────
  if (data === "cat_add_new") {
    setState(chatId, "cat_add_new", {});
    return bot.sendMessage(chatId, "🏷 Send the *category name* (e.g. Photography):", { parse_mode:"Markdown", reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_categories"}]]} });
  }
  if (data.startsWith("cat_item_"))       return categories.showCategory(bot, chatId, data.replace("cat_item_",""));
  if (data.startsWith("cat_edit_label_")) { setState(chatId,"cat_edit_label",{catId:data.replace("cat_edit_label_","")}); return bot.sendMessage(chatId,"✏️ Send new category label:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_categories"}]]}}); }
  if (data.startsWith("cat_edit_slug_"))  { setState(chatId,"cat_edit_slug", {catId:data.replace("cat_edit_slug_","") }); return bot.sendMessage(chatId,"✏️ Send new slug (lowercase, hyphens only e.g. `web-design`):",{parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_categories"}]]}}); }
  if (data.startsWith("cat_delete_")) {
    const catId = data.replace("cat_delete_","");
    return bot.sendMessage(chatId,"⚠️ Delete this category?",{reply_markup:{inline_keyboard:[[{text:"🗑 Yes",callback_data:`cat_confirm_del_${catId}`},{text:"❌ Cancel",callback_data:`cat_item_${catId}`}]]}});
  }
  if (data.startsWith("cat_confirm_del_")) { clearState(chatId); return categories.deleteCategory(bot, chatId, data.replace("cat_confirm_del_","")); }

  // ── Portfolio ──────────────────────────────────────────────
  if (data === "port_add_new") return portfolio.startAddProject(bot, chatId);
  if (data.startsWith("port_item_"))        return portfolio.showItem(bot, chatId, data.replace("port_item_",""), msgId);
  if (data.startsWith("port_toggle_vis_"))  return portfolio.toggleVisibility(bot, chatId, data.replace("port_toggle_vis_",""), msgId);
  if (data.startsWith("port_confirm_del_")) { clearState(chatId); return portfolio.deleteItem(bot, chatId, data.replace("port_confirm_del_","")); }
  if (data.startsWith("port_delete_")) {
    const itemId = data.replace("port_delete_","");
    return bot.sendMessage(chatId,"⚠️ Delete this project? Cannot be undone.",{reply_markup:{inline_keyboard:[[{text:"🗑 Yes, delete",callback_data:`port_confirm_del_${itemId}`},{text:"❌ Cancel",callback_data:`port_item_${itemId}`}]]}});
  }

  const portTextFields = { "port_edit_title_":"port_edit_title","port_set_image_":"port_edit_imageUrl","port_set_video_":"port_edit_videoUrl","port_set_link_":"port_edit_link","port_set_desc_":"port_edit_description" };
  const portPrompts    = { "port_edit_title":"Send the new *project title*:","port_edit_imageUrl":"Send the *image URL* (direct link ending in .jpg/.png etc):\n_Recommended: 1200×900px_","port_edit_videoUrl":"Send the *YouTube URL* (or `-` to remove):","port_edit_link":"Send the project URL (or `-` to remove):","port_edit_description":"Send the project description:" };
  for (const [prefix, action] of Object.entries(portTextFields)) {
    if (data.startsWith(prefix)) {
      const itemId = data.replace(prefix,"");
      setState(chatId, action, { itemId });
      return bot.sendMessage(chatId, portPrompts[action], { parse_mode:"Markdown", reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:`port_item_${itemId}`}]]} });
    }
  }
  if (data.startsWith("port_edit_cat_")) {
    const itemId = data.replace("port_edit_cat_","");
    const snap   = await db.collection("categories").orderBy("order").get();
    const catBtns = snap.docs.map(d => [{ text: d.data().label, callback_data:`port_setcat_${itemId}_${d.data().slug}` }]);
    catBtns.push([{ text:"❌ Cancel", callback_data:`port_item_${itemId}` }]);
    return bot.sendMessage(chatId,"🏷 Choose a category:", { reply_markup:{ inline_keyboard: catBtns } });
  }
  if (data.startsWith("port_setcat_")) {
    const parts  = data.split("_"); // port_setcat_ITEMID_SLUG — but itemId can have underscores
    // format: port_setcat_{itemId}_{slug}  — slug has no underscores (hyphens only)
    const slug   = parts[parts.length - 1];
    const itemId = parts.slice(2, parts.length - 1).join("_");
    return portfolio.updateField(bot, chatId, itemId, "category", slug);
  }

  // ── CV ────────────────────────────────────────────────────
  if (data === "cv_add_new") return cv.startAddCvEntry(bot, chatId);
  if (data.startsWith("cv_item_")) return cv.showCvEntry(bot, chatId, data.replace("cv_item_",""), msgId);
  const cvFields = { "cv_edit_title_":"cv_edit_title","cv_edit_period_":"cv_edit_period","cv_edit_place_":"cv_edit_place","cv_edit_desc_":"cv_edit_desc" };
  const cvPrompts = { "cv_edit_title":"✏️ Send new job title:","cv_edit_period":"📅 Send new period (e.g. 2023 – 2024):","cv_edit_place":"🏢 Send company/place name:","cv_edit_desc":"📝 Send job description:" };
  for (const [prefix, action] of Object.entries(cvFields)) {
    if (data.startsWith(prefix)) {
      const entryId = data.replace(prefix,"");
      setState(chatId, action, { entryId });
      return bot.sendMessage(chatId, cvPrompts[action], { reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:`cv_item_${entryId}`}]]} });
    }
  }
  if (data.startsWith("cv_delete_")) {
    const id = data.replace("cv_delete_","");
    return bot.sendMessage(chatId,"⚠️ Delete this entry?",{reply_markup:{inline_keyboard:[[{text:"🗑 Yes",callback_data:`cv_confirm_del_${id}`},{text:"❌ No",callback_data:`cv_item_${id}`}]]}});
  }
  if (data.startsWith("cv_confirm_del_")) { clearState(chatId); return cv.deleteCvEntry(bot, chatId, data.replace("cv_confirm_del_","")); }

  // ── Skills ────────────────────────────────────────────────
  if (data === "skill_add_group")          { setState(chatId,"skill_add_group",{}); return bot.sendMessage(chatId,"🏷 Send new group name:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_skills"}]]}}); }
  if (data.startsWith("skill_group_"))     return cv.showSkillGroup(bot, chatId, data.replace("skill_group_",""), msgId);
  if (data.startsWith("skill_rename_"))    { setState(chatId,"skill_rename",   {groupId:data.replace("skill_rename_","")}   ); return bot.sendMessage(chatId,"✏️ Send new group name:"); }
  if (data.startsWith("skill_add_"))       { setState(chatId,"skill_add",      {groupId:data.replace("skill_add_","")    }  ); return bot.sendMessage(chatId,"➕ Send skill name to add:"); }
  if (data.startsWith("skill_remove_"))    { setState(chatId,"skill_remove",   {groupId:data.replace("skill_remove_","") }  ); return bot.sendMessage(chatId,"➖ Send exact skill name to remove:"); }
  if (data.startsWith("skill_delgroup_"))  { const id=data.replace("skill_delgroup_",""); return bot.sendMessage(chatId,"⚠️ Delete this skill group?",{reply_markup:{inline_keyboard:[[{text:"🗑 Yes",callback_data:`skill_confirm_del_${id}`},{text:"❌ Cancel",callback_data:`skill_group_${id}`}]]}}); }
  if (data.startsWith("skill_confirm_del_")) { clearState(chatId); return cv.deleteSkillGroup(bot, chatId, data.replace("skill_confirm_del_","")); }

  // ── Hero ──────────────────────────────────────────────────
  if (data === "hero_remove_logo") return sections.removeNavLogo(bot, chatId);
  for (const f of ["firstName","lastName","tagline","subtitle","cta1Text","cta1Link","cta2Text","cta2Link","logoUrl"]) {
    if (data === `hero_edit_${f}`) {
      setState(chatId,"hero_edit_field",{field:f,doc:"hero"});
      return bot.sendMessage(chatId,`✏️ Send new value for *${f}*:`,{parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_hero"}]]}});
    }
  }

  // ── About ─────────────────────────────────────────────────
  if (data === "about_remove_photo") return sections.removeProfilePhoto(bot, chatId);
  if (data === "about_edit_eyebrow")         { setState(chatId,"about_edit_field",{field:"eyebrow",doc:"about"});         return bot.sendMessage(chatId,"✏️ Send new eyebrow:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}}); }
  if (data === "about_edit_heading")         { setState(chatId,"about_edit_field",{field:"heading",doc:"about"});         return bot.sendMessage(chatId,"✏️ Send new heading:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}}); }
  if (data === "about_edit_para0")           { setState(chatId,"about_para",{index:0});                                   return bot.sendMessage(chatId,"✏️ Send new paragraph 1:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}}); }
  if (data === "about_edit_para1")           { setState(chatId,"about_para",{index:1});                                   return bot.sendMessage(chatId,"✏️ Send new paragraph 2:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}}); }
  if (data === "about_edit_profilePhotoUrl") { setState(chatId,"about_edit_field",{field:"profilePhotoUrl",doc:"about"}); return bot.sendMessage(chatId,"🖼 Send profile photo URL:",{reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}}); }
  if (data === "about_edit_stats") {
    setState(chatId,"about_edit_stats",{});
    return bot.sendMessage(chatId,"📊 Send 3 stats, one per line:\n`value|label`\n\nExample:\n`4+|Years experience\n10+|Projects\n100%|Creative output`",{parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_about"}]]}});
  }

  // ── Contact ───────────────────────────────────────────────
  if (data === "contact_edit_eyebrow") { setState(chatId,"generic_field",{field:"eyebrow",doc:"contact"}); return bot.sendMessage(chatId,"✏️ Send new eyebrow:"); }
  if (data === "contact_edit_heading") { setState(chatId,"generic_field",{field:"heading",doc:"contact"}); return bot.sendMessage(chatId,"✏️ Send new heading:"); }
  if (data === "contact_edit_body")    { setState(chatId,"generic_field",{field:"body",   doc:"contact"}); return bot.sendMessage(chatId,"✏️ Send new body text:"); }

  // ── Settings ──────────────────────────────────────────────
  for (const f of ["email","cvUrl","siteTitle","siteDesc","ownerName","portfolioName","faviconUrl","cvFileType"]) {
    if (data === `settings_edit_${f}`) {
      setState(chatId,"generic_field",{field:f,doc:"settings"});
      const hint = f === "cvFileType" ? "✏️ Send file type label (e.g. `PDF`, `DOCX`, `Google Doc`):" :
                   f === "faviconUrl" ? "🌐 Send favicon URL (direct link to .ico or .png file):" :
                   f === "portfolioName" ? "✏️ Send the portfolio header name (shows in nav, e.g. `John Doe`):" :
                   `✏️ Send new value for *${f}*:`;
      return bot.sendMessage(chatId, hint, {parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_settings"}]]}});
    }
  }

  // ── Social ────────────────────────────────────────────────
  for (const p of ["linkedin","behance","instagram","dribbble"]) {
    if (data === `social_edit_${p}`) {
      setState(chatId,"social_edit",{platform:p});
      return bot.sendMessage(chatId,`✏️ Send new *${p}* URL:`,{parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_contact"}]]}});
    }
  }

  // ── Colors ────────────────────────────────────────────────
  if (data === "color_reset_defaults") return sections.resetColors(bot, chatId);
  for (const k of ["ink","paper","warm","accent","muted","line","heroText","navText","bodyText","footerText","navBg","navScrollBg","navScrollBorder"]) {
    if (data === `color_edit_${k}`) {
      setState(chatId,"color_edit",{colorKey:k});
      return bot.sendMessage(chatId,`🎨 Send hex for *${k}* (e.g. \`#C8441B\`):`,{parse_mode:"Markdown",reply_markup:{inline_keyboard:[[{text:"❌ Cancel",callback_data:"menu_colors"}]]}});
    }
  }
});

// ─── Text message handler ─────────────────────────────────────────────────────
bot.on("message", async msg => {
  if (!isAdmin(msg)) return;
  if (msg.text?.startsWith("/")) return;
  if (msg.photo) return;

  const chatId = msg.chat.id;
  const text   = msg.text?.trim();
  const state  = getState(chatId);
  if (!state || !text) return;

  const { action, meta } = state;

  const backTo = (section) => ({ inline_keyboard: [[{text:`⬅️ Back to ${section}`,callback_data:`menu_${section.toLowerCase()}`},{text:"🏠 Main Menu",callback_data:"menu_main"}]] });

  // Portfolio
  if (action === "port_edit_title")       { clearState(chatId); return portfolio.updateField(bot, chatId, meta.itemId, "title",       text); }
  if (action === "port_edit_description") { clearState(chatId); return portfolio.updateField(bot, chatId, meta.itemId, "description", text); }
  if (action === "port_edit_link")        { clearState(chatId); return portfolio.updateField(bot, chatId, meta.itemId, "link",        text==="-"?"":text); }
  if (action === "port_edit_videoUrl")    { clearState(chatId); return portfolio.updateField(bot, chatId, meta.itemId, "videoUrl",    text==="-"?"":text); }
  if (action === "port_edit_imageUrl")    { clearState(chatId); return portfolio.updateField(bot, chatId, meta.itemId, "imageUrl",    text==="-"?"":text); }

  // CV
  if (action === "cv_edit_title")  { clearState(chatId); return cv.updateCvField(bot, chatId, meta.entryId, "title",       text); }
  if (action === "cv_edit_period") { clearState(chatId); return cv.updateCvField(bot, chatId, meta.entryId, "period",      text); }
  if (action === "cv_edit_place")  { clearState(chatId); return cv.updateCvField(bot, chatId, meta.entryId, "place",       text); }
  if (action === "cv_edit_desc")   { clearState(chatId); return cv.updateCvField(bot, chatId, meta.entryId, "description", text); }

  // Skills
  if (action === "skill_add_group") { clearState(chatId); return cv.addSkillGroup(bot, chatId, text); }
  if (action === "skill_rename")    { clearState(chatId); return cv.renameSkillGroup(bot, chatId, meta.groupId, text); }
  if (action === "skill_add")       { clearState(chatId); return cv.addSkillToGroup(bot, chatId, meta.groupId, text); }
  if (action === "skill_remove")    { clearState(chatId); return cv.removeSkillFromGroup(bot, chatId, meta.groupId, text); }

  // Categories
  if (action === "cat_add_new")    { clearState(chatId); return categories.addCategory(bot, chatId, text); }
  if (action === "cat_edit_label") { clearState(chatId); return categories.updateCategoryField(bot, chatId, meta.catId, "label", text); }
  if (action === "cat_edit_slug") {
    if (!/^[a-z0-9-]+$/.test(text)) {
      return retryInput(bot, chatId, "cat_edit_slug", meta, "Invalid slug. Use lowercase letters and hyphens only (e.g. `web-design`).", "Send a valid slug:");
    }
    clearState(chatId); return categories.updateCategoryField(bot, chatId, meta.catId, "slug", text);
  }

  // Hero
  if (action === "hero_edit_field") {
    clearState(chatId);
    await sections.setField("hero", meta.field, text);
    return bot.sendMessage(chatId,`✅ *${meta.field}* updated.`,{parse_mode:"Markdown",reply_markup:backTo("Hero")});
  }

  // About
  if (action === "about_edit_field") {
    clearState(chatId);
    await sections.setField("about", meta.field, text);
    return bot.sendMessage(chatId,`✅ *${meta.field}* updated.`,{parse_mode:"Markdown",reply_markup:backTo("About")});
  }
  if (action === "about_para") { clearState(chatId); return sections.editAboutParagraph(bot, chatId, meta.index, text); }
  if (action === "about_edit_stats") {
    clearState(chatId);
    const stats = text.split("\n").slice(0,3).map(l => { const [v,...r] = l.split("|"); return {value:v.trim(),label:r.join("|").trim()}; });
    await db.collection("site").doc("about").update({ stats, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return bot.sendMessage(chatId,`✅ Stats updated.`,{reply_markup:backTo("About")});
  }

  // Contact / generic
  if (action === "generic_field") {
    clearState(chatId);
    await sections.setField(meta.doc, meta.field, text);
    const section = meta.doc === "contact" ? "Contact" : "Settings";
    return bot.sendMessage(chatId,`✅ *${meta.field}* updated.`,{parse_mode:"Markdown",reply_markup:backTo(section)});
  }

  // Social
  if (action === "social_edit") { clearState(chatId); return sections.updateSocial(bot, chatId, meta.platform, text); }

  // Color — retry on bad hex instead of dropping
  if (action === "color_edit") {
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(text)) {
      return retryInput(bot, chatId, "color_edit", meta,
        `\`${text}\` is not a valid hex color.`,
        `Send a valid hex for *${meta.colorKey}* (e.g. \`#C8441B\`):`
      );
    }
    clearState(chatId); return sections.updateColor(bot, chatId, meta.colorKey, text);
  }
});

// ─── Express health ───────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;
app.get("/",       (_,res) => res.send("🤖 CareerCanvas Bot is running."));
app.get("/health", (_,res) => res.json({ status:"ok", ts: new Date().toISOString() }));
app.listen(PORT, () => console.log(`✅ Bot running on port ${PORT}`));
console.log("🤖 CareerCanvas Bot started. Admin:", ADMIN_ID);
