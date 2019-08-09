const fs = require('fs')
const path = require('path')

function getDirList(dir_path) {
    const item_list = []
    const dir = fs.readdirSync(dir_path)
    dir.forEach(item => {
        if (item.indexOf('.') === 0) return
        const item_path = path.join(dir_path, item)
        item_list.push(item_path);
    })
    return item_list
}

function isDirEmpty(dir_path) {
    const dir = fs.readdirSync(dir_path)
    return dir.length === 0
}

const MINA_I18N_JS_STR = `
const mina_i18n_data = require('./mina-i18n-data')
function getI18NData(text, lang) {
    if (!lang) {
        lang = 'en'
    }
    if (mina_i18n_data[text] && mina_i18n_data[text][lang]) {
        return mina_i18n_data[text][lang]
    }
    return text
}
function getI18NLang() {
    /*
     *  Default to english,
     *  You should rewrite this function.
     */
    return 'en'
}
wx._t = getI18NData
wx.getL = getI18NLang
module.exports = { getI18NData, getI18NLang }
`

module.exports = {
    getDirList,
    isDirEmpty,
    MINA_I18N_JS_STR
}