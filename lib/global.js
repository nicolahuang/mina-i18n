const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const yargs = require('yargs')
const {
    getDirList,
    MINA_I18N_JS_STR,
    isDirEmpty
} = require('./util')
const argv = yargs.argv

if (argv._.length < 2) {
    logError(`
mina-i18n needs two params at least, the origin mina project path, and the path for i18n mina project.\n
The i18n mina project path must be empty or not exists.\n
Typing as below:\n
mina-i18n /path/to/the/origin/mina/project /path/to/i18n/mina/project
    `)
    process.exit()
}

const includePathArgv = argv['include-path'] || ''
const includePath = includePathArgv.split(',').filter(item => !!item)

const [fromPath, toPath] = argv._

function logError(text) {
    console.log(chalk.red(text))
}

function logSucc(text) {
    console.log(chalk.green(text))
}

const SOURCE_MINA_PATH = path.resolve(fromPath)
const MINA_PATH = path.resolve(toPath)

// console.log(`SOURCE_MINA_PATH = ${SOURCE_MINA_PATH}, MINA_PATH = ${MINA_PATH}`)

// 判断原小程序项目目录是否存在且合法
if (!fs.existsSync(SOURCE_MINA_PATH)) {
    logError(`${SOURCE_MINA_PATH} is not exists.`)
    process.exit()
}

const APP_JS_PATH = path.join(SOURCE_MINA_PATH, 'app.js')
const PAGES_PATH = path.join(SOURCE_MINA_PATH, 'pages')
const APP_JSON_PATH = path.join(SOURCE_MINA_PATH, 'app.json')
const PAGES_PATH_STAT = fs.statSync(PAGES_PATH)

if (
    !fs.existsSync(APP_JS_PATH)
 || !fs.existsSync(PAGES_PATH)
 || !fs.existsSync(APP_JSON_PATH)
 || !PAGES_PATH_STAT.isDirectory()
) {
    logError(`${SOURCE_MINA_PATH} is not a mina project path.`)
}

if (fs.existsSync(MINA_PATH) && !isDirEmpty(MINA_PATH)) {
    logError(`${MINA_PATH} is not empty, the i18n mina project path must be empty or not exists`)
    process.exit()
}

const includeAbsPath = [PAGES_PATH, APP_JS_PATH]
includePath.forEach(item_path => {
    const absPath = path.join(SOURCE_MINA_PATH, item_path)
    if (!fs.existsSync(absPath)) {
        logError(`include-path: ${item_path} is not exists, will be ignored.`)
    } else {
        includeAbsPath.push(absPath)
    }
})

function isIncludePath(item_path) {
    return includeAbsPath.includes(item_path)
}

const i18n_global_folder_path = path.join(MINA_PATH, 'i18n')
const zh_cn_i18n_json_path = path.join(i18n_global_folder_path, 'zh-CN.json')
const en_us_i18n_json_path = path.join(i18n_global_folder_path, 'en-US.json')
const i18n_wxs_path = path.join(MINA_PATH, 'mina-i18n.wxs')
const i18n_data_path = path.join(MINA_PATH, 'mina-i18n-data.js')
const i18n_js_path = path.join(MINA_PATH, 'mina-i18n.js')
const i18n_json = {}
const i18n_process_promise = []
const MINA_I18N_JS_FUNCTION_CALLEE = 'i18n'
const MINA_I18N_LANG_NAME = ''
const MINA_I18N_FUNCTION_NAME = 't'

fs.mkdirSync(MINA_PATH)
fs.mkdirSync(i18n_global_folder_path)
// fs.writeFileSync(i18n_js_path, MINA_I18N_JS_STR)

const item_path_list = getDirList(SOURCE_MINA_PATH)

const IGNORE_FILE_PATH = path.join(SOURCE_MINA_PATH, '.mina_i18n_ignore')
const IGNORE_FILE_LIST = []
if (fs.existsSync(IGNORE_FILE_PATH)) {
    const mina_i18n_ignore_content = fs.readFileSync(IGNORE_FILE_PATH)
    try {
        const mina_i18n_ignore = JSON.parse(mina_i18n_ignore_content.toString())
        if (Array.isArray(mina_i18n_ignore.ignore_list)) {
            mina_i18n_ignore.ignore_list.forEach(item => {
                IGNORE_FILE_LIST.push(path.join(SOURCE_MINA_PATH, item))
            })
        }
    } catch (e) {
    }
}

function isIgnorePath(item_path) {
    return IGNORE_FILE_LIST.includes(item_path)
}

module.exports = {
    logError,
    logSucc,
    APP_JS_PATH,
    PAGES_PATH,
    APP_JSON_PATH,
    PAGES_PATH_STAT,
    MINA_PATH,
    isIncludePath,
    i18n_global_folder_path,
    zh_cn_i18n_json_path,
    en_us_i18n_json_path,
    i18n_wxs_path,
    i18n_data_path,  
    i18n_js_path,
    i18n_json,
    i18n_process_promise,
    MINA_I18N_JS_FUNCTION_CALLEE,
    MINA_I18N_LANG_NAME,
    MINA_I18N_FUNCTION_NAME,
    item_path_list,
    isIgnorePath
}