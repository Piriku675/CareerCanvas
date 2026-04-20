/**
 * utils/keyboards.js
 */

function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "🖼  Portfolio",   callback_data: "menu_portfolio"  }, { text: "👤  About",      callback_data: "menu_about"      }],
      [{ text: "🦸  Hero",        callback_data: "menu_hero"       }, { text: "💼  Experience", callback_data: "menu_cv"         }],
      [{ text: "🛠  Skills",      callback_data: "menu_skills"     }, { text: "📬  Contact",    callback_data: "menu_contact"    }],
      [{ text: "🎨  Colors",      callback_data: "menu_colors"     }, { text: "🏷  Categories", callback_data: "menu_categories" }],
      [{ text: "⚙️  Settings",   callback_data: "menu_settings"   }, { text: "📖  How to Use", callback_data: "menu_help"       }],
    ],
  };
}

function backMain() {
  return { inline_keyboard: [[{ text: "⬅️  Main Menu", callback_data: "menu_main" }]] };
}

function confirmCancel(confirmData) {
  return {
    inline_keyboard: [[
      { text: "✅ Confirm", callback_data: confirmData },
      { text: "❌ Cancel",  callback_data: "cancel"    },
    ]],
  };
}

function portfolioItemActions(itemId) {
  return {
    inline_keyboard: [
      [{ text: "✏️ Title",      callback_data: `port_edit_title_${itemId}`   }, { text: "🏷 Category",   callback_data: `port_edit_cat_${itemId}`    }],
      [{ text: "🖼 Image URL",  callback_data: `port_set_image_${itemId}`    }, { text: "🎬 Video URL",  callback_data: `port_set_video_${itemId}`   }],
      [{ text: "🔗 Link",       callback_data: `port_set_link_${itemId}`     }, { text: "📝 Description",callback_data: `port_set_desc_${itemId}`    }],
      [{ text: "👁 Toggle visible", callback_data: `port_toggle_vis_${itemId}` }, { text: "🗑 Delete",  callback_data: `port_delete_${itemId}`      }],
      [{ text: "⬅️ Portfolio",  callback_data: "menu_portfolio"              }, { text: "🏠 Main Menu", callback_data: "menu_main"                  }],
    ],
  };
}

function cvEntryActions(entryId) {
  return {
    inline_keyboard: [
      [{ text: "✏️ Title",  callback_data: `cv_edit_title_${entryId}`  }, { text: "📅 Period", callback_data: `cv_edit_period_${entryId}` }],
      [{ text: "🏢 Place",  callback_data: `cv_edit_place_${entryId}`  }, { text: "📝 Desc",   callback_data: `cv_edit_desc_${entryId}`   }],
      [{ text: "🗑 Delete", callback_data: `cv_delete_${entryId}`      }],
      [{ text: "⬅️ Experience", callback_data: "menu_cv"               }, { text: "🏠 Main Menu", callback_data: "menu_main"              }],
    ],
  };
}

function skillGroupActions(groupId) {
  return {
    inline_keyboard: [
      [{ text: "✏️ Rename",     callback_data: `skill_rename_${groupId}`   }, { text: "➕ Add skill",   callback_data: `skill_add_${groupId}`      }],
      [{ text: "➖ Remove skill",callback_data: `skill_remove_${groupId}`   }, { text: "🗑 Delete group",callback_data: `skill_delgroup_${groupId}` }],
      [{ text: "⬅️ Skills",     callback_data: "menu_skills"               }, { text: "🏠 Main Menu",   callback_data: "menu_main"                 }],
    ],
  };
}

module.exports = { mainMenu, backMain, confirmCancel, portfolioItemActions, cvEntryActions, skillGroupActions };
