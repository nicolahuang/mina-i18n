#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const {
    isIncludePath,
    // i18n_wxs_path,
    // i18n_data_path,  
    i18n_json,
    zh_cn_i18n_json_path,
    en_us_i18n_json_path,
    i18n_process_promise,
    item_path_list,
    MINA_PATH,
    logSucc
} = require('./lib/global')
const { processFileToI18N, processPageFolder } = require('./lib/file_processor')
const {
    prettyJSON
} = require('./lib/i18n_util')

logSucc('文件转换中...')
item_path_list.forEach(item_path => {
    const item_stat = fs.statSync(item_path)
    if (isIncludePath(item_path)) {
        const item_base_name = path.basename(item_path)
        const new_item_path = path.join(MINA_PATH, item_base_name)
        if (item_stat.isDirectory()) {
            processPageFolder(item_path, new_item_path)
        } else if (item_stat.isFile()){
            processFileToI18N(item_path, new_item_path)
        }
    } else {
        const item_base_name = path.basename(item_path)
        const new_item_path = path.join(MINA_PATH, item_base_name)
        execSync(`cp -R ${item_path} ${new_item_path}`)
    }
})
logSucc('文本翻译中...')
Promise.all(i18n_process_promise).then(() => {
//     const i18nWXS = `var json = ${prettyJSON(i18n_json)};
// module.exports = function(text, lang = 'en') {
//     if (json[text] && json[text][lang]) {
//         return json[text][lang]
//     }
//     return text
// }`
//     fs.writeFileSync(i18n_wxs_path, i18nWXS)
//     fs.writeFileSync(i18n_data_path, 'module.exports = ' + prettyJSON(i18n_json))
    const zh_cn_json = prettyJSON(i18n_json['zh-CN'] || {})
    const en_us_json = prettyJSON(i18n_json['en-US'] || {})
    fs.writeFileSync(zh_cn_i18n_json_path, zh_cn_json)
    fs.writeFileSync(en_us_i18n_json_path, en_us_json)
    logSucc(`小程序已完成转换，请使用微信开发者工具打开 ${MINA_PATH} 目录进行预览`)
})
