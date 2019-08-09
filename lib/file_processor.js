const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')
const t = require('@babel/types')
const prettier = require("prettier")
const htmlparser = require('./htmlparser2')
const {
    APP_JS_PATH,
    isIgnorePath,
    MINA_I18N_JS_FUNCTION_CALLEE,
    MINA_I18N_LANG_NAME,
    MINA_I18N_GETLANG_FUNCTION_NAME,
    MINA_I18N_FUNCTION_NAME,
    i18n_wxs_path
} = require('./global')
const { getDirList } = require('./util')
const {
    createI18NData,
    transformText,
    processHTMLJson,
    prettyJSON,
    buildWXML
} = require('./i18n_util')

const visitor = {
    StringLiteral(path) {
        const parentPath = path.parent
        // 每个中文字符串只处理一次，识别到已处理过就退出，不然会死循环
        if (t.isCallExpression(parentPath)) {
            const callee = parentPath.callee
            if (t.isMemberExpression(callee)) {
                const { object, property } = callee
                if (
                    t.isIdentifier(object) &&
                    object.name === MINA_I18N_JS_FUNCTION_CALLEE &&
                    property.name === MINA_I18N_FUNCTION_NAME
                ) {
                    return
                }
            }
        }
        const reg = /\s*[\u4E00-\u9FA5]+\s*/g
        const stringValue = path.node.value
        if (reg.test(stringValue)) {
            path.replaceWith(t.CallExpression(
                t.MemberExpression(
                    t.identifier(MINA_I18N_JS_FUNCTION_CALLEE),
                    t.identifier(MINA_I18N_FUNCTION_NAME)
                ),
                [t.stringLiteral(stringValue)]
            ))
            createI18NData(stringValue)
        }
    },
    ObjectProperty(path, state) {
        if (path.node.key.name === 'data') {
            const parentPath = path.parentPath || {}
            const parentParentPath = parentPath.parentPath || {}
            const node = parentParentPath.node
            if (
                t.isObjectExpression(parentPath) &&
                t.isCallExpression(parentParentPath) &&
                node && node.callee && t.isIdentifier(node.callee) &&
                node.callee.name === 'Page'
            ) {
                // 变量插入只处理一次，识别到已处理过就退出，不然会死循环
                if (
                    t.isCallExpression(path.node.value) &&
                    t.isObjectExpression(path.node.value.arguments[0]) &&
                    path.node.value.arguments[0].properties[0].key.name === MINA_I18N_LANG_NAME
                ) {
                    return
                }
                path.replaceWith(
                    t.objectProperty(
                        path.node.key,
                        t.CallExpression(
                            t.MemberExpression(
                                t.identifier('Object'),
                                t.identifier('assign')
                            ),
                            [
                                t.objectExpression([
                                    t.objectProperty(
                                        t.identifier(MINA_I18N_LANG_NAME),
                                        t.CallExpression(
                                            t.MemberExpression(
                                                t.identifier(MINA_I18N_JS_FUNCTION_CALLEE),
                                                t.identifier(MINA_I18N_GETLANG_FUNCTION_NAME)
                                            ),
                                            []
                                        )
                                    )
                                ]),
                                path.node.value
                            ]
                        )
                    )
                )
            }
        }
    }
}

function processFileToI18N(source_file_path, destination_path) {
    if (!fs.existsSync(source_file_path)) {
        throw `processFileToI18N fail, source_file_path : ${source_file_path} is not exists!`
    }
    if (fs.existsSync(destination_path)) {
        throw `processFileToI18N fail, destination_path : ${destination_path} is exists!`
    }
    if (!fs.existsSync(APP_JS_PATH)) {
        throw `processFileToI18N fail, APP_JS_PATH : ${APP_JS_PATH} is not exists!`
    }
    const ext_name = path.extname(source_file_path)
    const dirpath = path.dirname(destination_path)
    const isIgnore = isIgnorePath(source_file_path)
    if (ext_name === '.js' && !isIgnore) {
        const content_buffer = fs.readFileSync(source_file_path)
        const content = content_buffer.toString()
        const result = babel.transform(content, {
            plugins: [
                { visitor }
            ],
            generatorOpts: {
                quotes: 'single',
                compact: false
            }
        })
        const codeResult = prettier.format(result.code, {
            parser: "babel",
            semi: false,
            singleQuote: true
        })
        let code = transformText(codeResult)
        if (source_file_path === APP_JS_PATH) {
            code = `require('./mina-i18n')\n` + code
        }
        fs.writeFileSync(destination_path, code, 'utf8')
    } else if (ext_name === '.wxml' && !isIgnore) {
        const wxs_path = path.relative(dirpath, i18n_wxs_path)
        const xmlString = fs.readFileSync(source_file_path).toString()
        let wxmlJson = null

        try {
            wxmlJson = htmlparser.parseDOM(xmlString, {
                recognizeSelfClosing: true,
                distinguishEmptyAttribute: true
            })
        } catch (e) {
            console.log('wxml to json err: ', e)
        }
        if (wxmlJson) {
            processHTMLJson(wxmlJson)
            const json_str_pretty = prettyJSON(wxmlJson)
            fs.writeFileSync(destination_path + '.json', json_str_pretty, 'utf8')
            fs.writeFileSync(destination_path, `<wxs src="${wxs_path}" module="${MINA_I18N_FUNCTION_NAME}" />\n` + buildWXML(wxmlJson), 'utf8')
        }
    } else {
        const file_content = fs.readFileSync(source_file_path)
        fs.writeFileSync(destination_path, file_content)
        if (isIgnore) {
            console.log(`${destination_path} is isIgnorePath!`)
        }
    }
}

function processPageFolder(source_path, destination_path) {
    if (!fs.existsSync(source_path)) {
        throw `processPageFolder fail, source_path : ${source_path} is not exists!`
    }
    if (fs.existsSync(destination_path)) {
        throw `processPageFolder fail, destination_path : ${destination_path} is exists!`
    }
    if(isIgnorePath(source_path)) {
        execSync(`cp -R ${source_path} ${destination_path}`)
        return
    }
    const item_stat = fs.statSync(source_path)
    if (item_stat.isDirectory()) {
        fs.mkdirSync(destination_path)
        const page_file_list = getDirList(source_path)
        page_file_list.forEach(file_path => {
            const file_stat = fs.statSync(file_path)
            const basename = path.basename(file_path)
            const new_destination_path = path.join(destination_path, basename)
            if (file_stat.isFile()) {
                processFileToI18N(file_path, new_destination_path, APP_JS_PATH)
            } else if (file_stat.isDirectory()) {
                processPageFolder(file_path, new_destination_path)
            }
        })
    } else if (item_stat.isFile()) {
        processFileToI18N(source_path, destination_path, APP_JS_PATH)
    }
}

module.exports = {
    processFileToI18N,
    processPageFolder
}