/**
 * commands/sections.js
 * Manages Hero, About, Contact, Colors, and general Settings sections.
 */

const { db }       = require("../utils/firebase");
const { backMain } = require("../utils/keyboards");
const { setState } = require("../utils/state");
const admin        = require("firebase-admin");

// ─── Default colors ───────────────────────────────────────────────────────────
const DEFAULT_COLORS = {
  ink:         "#111010",
  paper:       "#F5F2ED",
  warm:        "#EDE9E1",
  accent:      "#C8441B",
  muted:       "#8A8578",
  line:        "#D9D5CC",
  heroText:    "#111010",
  navText:     "#8A8578",
  bodyText:    "#4A4540",
  footerText:  "#8A8578",
  navBg:        "#F5F2ED",
  navScrollBg:  "rgba(245,242,237,.95)",
  navScrollBorder: "#D9D5CC",
};

async function getDoc(docId) {
  const snap = await db.collection("site").doc(docId).get();
  return snap.exists ? snap.data() : {};
}

async function setField(docId, field, value) {
  await db.collection("site").doc(docId).update({
    [field]:   value,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ══════════════════════════════════════════════════════════════
//  HERO
// ══════════════════════════════════════════════════════════════
async function showHero(bot, chatId) {
  const d = await getDoc("hero");
  const logoMode = d.logoUrl ? "✅ Logo set" : "❌ No logo (showing text)";
  const text =
    `🦸 *Hero Section*\n\n` +
    `Name: *${d.firstName} ${d.lastName}*\n` +
    `Tagline: ${d.tagline}\n` +
    `Subtitle: ${d.subtitle}\n` +
    `CTA 1: ${d.cta1Text} → ${d.cta1Link}\n` +
    `CTA 2: ${d.cta2Text} → ${d.cta2Link}\n\n` +
    `Nav Logo: ${logoMode}`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ First name",        callback_data: "hero_edit_firstName"  }, { text: "✏️ Last name",      callback_data: "hero_edit_lastName"   }],
        [{ text: "✏️ Tagline",           callback_data: "hero_edit_tagline"    }, { text: "✏️ Subtitle",       callback_data: "hero_edit_subtitle"   }],
        [{ text: "✏️ CTA 1 text",        callback_data: "hero_edit_cta1Text"  }, { text: "✏️ CTA 1 link",     callback_data: "hero_edit_cta1Link"   }],
        [{ text: "✏️ CTA 2 text",        callback_data: "hero_edit_cta2Text"  }, { text: "✏️ CTA 2 link",     callback_data: "hero_edit_cta2Link"   }],
        [{ text: "🖼 Set nav logo URL",  callback_data: "hero_edit_logoUrl"   }, { text: "🗑 Remove logo",     callback_data: "hero_remove_logo"     }],
        [{ text: "⬅️ Main Menu",         callback_data: "menu_main"           }],
      ],
    },
  });
}

async function removeNavLogo(bot, chatId) {
  await db.collection("site").doc("hero").update({ logoUrl: "", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, "✅ Nav logo removed. Site will show text name again.", {
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Hero", callback_data: "menu_hero" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

// ══════════════════════════════════════════════════════════════
//  ABOUT
// ══════════════════════════════════════════════════════════════
async function showAbout(bot, chatId) {
  const d = await getDoc("about");
  const bodyPreview = (d.body || []).map((p, i) => `P${i+1}: ${p.slice(0,60)}…`).join("\n");
  const statsText   = (d.stats || []).map(s => `${s.value} — ${s.label}`).join(", ");
  const photoStatus = d.profilePhotoUrl ? "✅ Set" : "❌ Not set";

  const text =
    `👤 *About Section*\n\n` +
    `Eyebrow: ${d.eyebrow}\n` +
    `Heading: ${d.heading}\n\n` +
    `Body:\n${bodyPreview}\n\n` +
    `Stats: ${statsText}\n\n` +
    `Profile photo: ${photoStatus}`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Eyebrow",              callback_data: "about_edit_eyebrow"         }, { text: "✏️ Heading",          callback_data: "about_edit_heading"        }],
        [{ text: "✏️ Para 1",               callback_data: "about_edit_para0"           }, { text: "✏️ Para 2",           callback_data: "about_edit_para1"          }],
        [{ text: "📊 Edit stats",           callback_data: "about_edit_stats"           }],
        [{ text: "🖼 Set profile photo URL", callback_data: "about_edit_profilePhotoUrl"}, { text: "🗑 Remove photo",     callback_data: "about_remove_photo"        }],
        [{ text: "⬅️ Main Menu",            callback_data: "menu_main"                  }],
      ],
    },
  });
}

async function editAboutParagraph(bot, chatId, index, value) {
  const d    = await getDoc("about");
  const body = d.body || [];
  body[index] = value;
  await db.collection("site").doc("about").update({ body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, `✅ Paragraph ${index + 1} updated.`, {
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to About", callback_data: "menu_about" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

async function removeProfilePhoto(bot, chatId) {
  await db.collection("site").doc("about").update({ profilePhotoUrl: "", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, "✅ Profile photo removed.", {
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to About", callback_data: "menu_about" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

// ══════════════════════════════════════════════════════════════
//  CONTACT
// ══════════════════════════════════════════════════════════════
async function showContact(bot, chatId) {
  const d  = await getDoc("contact");
  const ds = await getDoc("settings");
  const text =
    `📬 *Contact Section*\n\n` +
    `Eyebrow: ${d.eyebrow}\n` +
    `Heading: ${d.heading}\n` +
    `Body: ${d.body}\n\n` +
    `Email: ${ds.email}\n` +
    `CV URL: ${ds.cvUrl}\n\n` +
    `Socials:\n` +
    Object.entries(ds.socials || {}).map(([k, v]) => `  ${k}: ${v}`).join("\n");

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Eyebrow",   callback_data: "contact_edit_eyebrow"  }, { text: "✏️ Heading",   callback_data: "contact_edit_heading" }],
        [{ text: "✏️ Body",      callback_data: "contact_edit_body"     }, { text: "✏️ Email",     callback_data: "settings_edit_email"  }],
        [{ text: "✏️ CV URL",    callback_data: "settings_edit_cvUrl"  }],
        [{ text: "✏️ LinkedIn",  callback_data: "social_edit_linkedin"  }, { text: "✏️ Behance",   callback_data: "social_edit_behance"  }],
        [{ text: "✏️ Instagram", callback_data: "social_edit_instagram" }, { text: "✏️ Dribbble",  callback_data: "social_edit_dribbble" }],
        [{ text: "⬅️ Main Menu", callback_data: "menu_main"             }],
      ],
    },
  });
}

async function updateSocial(bot, chatId, platform, url) {
  await db.collection("site").doc("settings").update({ [`socials.${platform}`]: url, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, `✅ ${platform} URL updated.`, {
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Contact", callback_data: "menu_contact" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

// ══════════════════════════════════════════════════════════════
//  COLORS
// ══════════════════════════════════════════════════════════════
async function showColors(bot, chatId) {
  const d      = await getDoc("settings");
  const colors = d.colors || {};
  const val    = (key) => colors[key] || DEFAULT_COLORS[key];

  const text =
    `🎨 *Color Scheme*\n\n` +
    `*Backgrounds & UI*\n` +
    `paper (main bg):  \`${val("paper")}\`\n` +
    `warm (alt bg):    \`${val("warm")}\`\n` +
    `accent:           \`${val("accent")}\`\n` +
    `line (borders):   \`${val("line")}\`\n\n` +
    `*Text Colors*\n` +
    `ink (headings):   \`${val("ink")}\`\n` +
    `muted (labels):   \`${val("muted")}\`\n` +
    `heroText:         \`${val("heroText")}\`\n` +
    `navText:          \`${val("navText")}\`\n` +
    `bodyText:         \`${val("bodyText")}\`\n` +
    `footerText:       \`${val("footerText")}\`\n\n` +
    `*Nav Scroll*\n` +
    `navBg:            \`${val("navBg")}\`\n` +
    `navScrollBg:      \`${val("navScrollBg")}\`\n` +
    `navScrollBorder:  \`${val("navScrollBorder")}\``;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🖊 paper",      callback_data: "color_edit_paper"      }, { text: "🖊 warm",       callback_data: "color_edit_warm"       }],
        [{ text: "🖊 accent",     callback_data: "color_edit_accent"     }, { text: "🖊 line",       callback_data: "color_edit_line"       }],
        [{ text: "── Text ─────────────────────", callback_data: "noop"  }],
        [{ text: "🖊 ink",        callback_data: "color_edit_ink"        }, { text: "🖊 muted",      callback_data: "color_edit_muted"      }],
        [{ text: "🖊 heroText",   callback_data: "color_edit_heroText"   }, { text: "🖊 navText",    callback_data: "color_edit_navText"    }],
        [{ text: "🖊 bodyText",   callback_data: "color_edit_bodyText"   }, { text: "🖊 footerText", callback_data: "color_edit_footerText" }],
        [{ text: "── Nav Scroll ─────────────────", callback_data: "noop"  }],
        [{ text: "🖊 navBg",      callback_data: "color_edit_navBg"          }, { text: "🖊 navScrollBg", callback_data: "color_edit_navScrollBg"   }],
        [{ text: "🖊 navScrollBorder", callback_data: "color_edit_navScrollBorder" }],
        [{ text: "🔄 Reset to defaults",         callback_data: "color_reset_defaults"              }],
        [{ text: "⬅️ Main Menu",  callback_data: "menu_main"             }],
      ],
    },
  });
}

async function updateColor(bot, chatId, colorKey, hexValue) {
  if (!/^#[0-9A-Fa-f]{3,8}$/.test(hexValue)) {
    return bot.sendMessage(chatId, "❌ Invalid hex. Use format `#RRGGBB` e.g. `#C8441B`", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Colors", callback_data: "menu_colors" }]] },
    });
  }
  await db.collection("site").doc("settings").update({ [`colors.${colorKey}`]: hexValue, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, `✅ *${colorKey}* set to \`${hexValue}\``, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Colors", callback_data: "menu_colors" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

async function resetColors(bot, chatId) {
  await db.collection("site").doc("settings").update({ colors: DEFAULT_COLORS, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await bot.sendMessage(chatId, "✅ All colors reset to defaults.", {
    reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Colors", callback_data: "menu_colors" }, { text: "🏠 Main Menu", callback_data: "menu_main" }]] },
  });
}

// ══════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════
async function showSettings(bot, chatId) {
  const d = await getDoc("settings");
  const text =
    `⚙️ *Site Settings*\n\n` +
    `Title: ${d.siteTitle}\n` +
    `Description: ${d.siteDesc}\n` +
    `Owner name: ${d.ownerName}\n` +
    `Portfolio name (header): ${d.portfolioName || d.ownerName}\n` +
    `Favicon URL: ${d.faviconUrl || "❌ Not set"}\n` +
    `CV file type: ${d.cvFileType || "PDF"}\n`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Site title",  callback_data: "settings_edit_siteTitle" }, { text: "✏️ Site desc",  callback_data: "settings_edit_siteDesc" }],
        [{ text: "✏️ Owner name",  callback_data: "settings_edit_ownerName" }, { text: "✏️ Portfolio name", callback_data: "settings_edit_portfolioName" }],
        [{ text: "🌐 Favicon URL",  callback_data: "settings_edit_faviconUrl"  }, { text: "📄 CV file type",   callback_data: "settings_edit_cvFileType"   }],
        [{ text: "⬅️ Main Menu",   callback_data: "menu_main"               }],
      ],
    },
  });
}

module.exports = {
  showHero, removeNavLogo,
  showAbout, editAboutParagraph, removeProfilePhoto,
  showContact, updateSocial,
  showColors, updateColor, resetColors,
  showSettings, setField, DEFAULT_COLORS,
};
