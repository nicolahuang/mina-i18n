const babel = require('@babel/core')
const t = require('@babel/types')
const request = require('request-promise-native')
const formatJSON = require('json-format')
const toSingleQuotes = require('to-single-quotes')
const OpenCC = require('opencc')
const opencc = new OpenCC()
const {
    i18n_process_promise,
    i18n_json,
    MINA_I18N_FUNCTION_NAME
} = require('./global')
/*
 * @lang ISO639-2 Code
 * zh-Hans: 简体中文
 * zh-Hant: 繁体中文
 * en     : 英文
 */
function createI18NData(text) {
    setI18NData(text, 'zh-CN')
    i18n_process_promise.push(setI18NData(text, 'en-US'))
}

function setI18NData(text, lang = 'zh-CN') {
    if (!i18n_json[lang]) {
        i18n_json[lang] = {}
    }
    if (lang === 'zh-CN') {
        i18n_json[lang][text] = text
        return text
    } else if (lang === 'zh-TW') {
        let hant_text = opencc.convertSync(text)
        i18n_json[lang][text] = hant_text
        return hant_text
    } else if (lang === 'en-US') {
        return translateToEnglish(text)
    }
}

function translateToEnglish(text, times = 0) {
    return request.post({
        url: 'https://cn.bing.com/ttranslatev3',
        form: {
            fromLang: 'zh-Hans',
            to: 'en',
            text: text
        },
        json: true,
        timeout: 2000
    }).then(res => {
        try {
            i18n_json['en-US'][text] = res[0].translations[0].text
        } catch (e) {
            i18n_json['en-US'][text] = ''
        }
        return i18n_json['en-US'][text]
    }).catch(err => {
        if (times >= 5) {
            i18n_json['en-US'][text] = ''
            return text
        } else {
            return translateToEnglish(text, times + 1)
        }
    })
}

const SELF_CLOSE_TAG = [
    'progress',
    'icon',
    'checkbox',
    'input',
    'radio',
    'slider',
    'switch',
    'textarea',
    'live-player',
    'live-pusher',
    'import',
    'include',
    'template'
]

function isSelfCloseTag(tagName) {
    if (typeof tagName !== 'string') {
        throw `${tagName} is no string`
    }
    return SELF_CLOSE_TAG.includes(tagName.trim())
}

function unicodeToHanzi(unicode) {
    const hanzi = unicode.split('\\u').filter(v => v)
    let str = ''
    for (let i = 0; i < hanzi.length; i += 1) {
        str += String.fromCharCode(parseInt(hanzi[i], 16).toString(10))
    }
    return str
}

function transformText(unicodeString) {
    return unicodeString.replace(/\s*(\\u[0-9A-Z]{4})+\s*/g, (match) => {
        return unicodeToHanzi(match)
    })
}

function processMinaTemplateText(text) {
    const textArray = text.split(/({{[^}]*}})/g)
    let returnText = ''
    textArray.forEach(item => {
        if (item.startsWith('{{') && item.endsWith('}}')) {
            let expression = item.substring(2, item.length - 2)
            returnText += '{{' + processMinaTemplateExpression(expression) + '}}'
        } else {
            returnText += processPlainText(item)
        }
    })
    return returnText
}

function processPlainText(text) {
    const reg = /(\s*)([\u4E00-\u9FA5]+)(\s*)/g
    return text.replace(reg, function (match, $1, $2, $3, offset, fullstring) {
        let hanzi = $2
        createI18NData(hanzi)
        return $1 + `{{${MINA_I18N_FUNCTION_NAME}('${hanzi}')}}` + $3
    })
}

function buildWXML(root) {
    if (Array.isArray(root)) {
        let xmlString = ''
        root.forEach(node => {
            xmlString += buildWXML(node)
        })
        return xmlString
    } else if (root.type === 'text') {
        const text = root.data
        return processMinaTemplateText(text)
    } else if (root.type === 'tag') {
        const tagName = root.name.replace('wx-', '')
        let tagString = `<${tagName}`
        const attr = root.attribs || {}
        Object.keys(attr).forEach(key => {
            if (attr[key] === null) {
                tagString += ` ${key}`
            } else {
                const attrValue = processMinaTemplateText(attr[key], {
                    isAttrValue: true
                })
                tagString += ` ${key}="${attrValue}"`
            }
        })
        const children = root.children || []

        if (isSelfCloseTag(tagName) && children.length === 0) {
            tagString += '/>'
        } else {
            tagString += '>'
            children.forEach(node => {
                tagString += buildWXML(node)
            })
            tagString += `</${tagName}>`
        }
        return tagString
    } else if (root.type === 'comment') {
        return `<!--${root.data}-->`
    } else {
        return ''
    }
}

function prettyJSON(json) {
    const jsonFormatConfig = {
        type: 'space',
        size: 4
    }
    return formatJSON(json, jsonFormatConfig)
}

function processHTMLJson(root) {
    if (Array.isArray(root)) {
        root.forEach(node => {
            processHTMLJson(node)
        })
    } else {
        delete root.next
        delete root.prev
        delete root.parent
        if (Array.isArray(root.children)) {
            root.children.forEach(node => {
                processHTMLJson(node)
            })
        }
    }
}

function processMinaTemplateExpression(code) {
    const visitor = {
        StringLiteral(path) {
            const parentPath = path.parent
            if (t.isCallExpression(parentPath)) {
                const callee = parentPath.callee
                if (t.isIdentifier(callee) && callee.name === MINA_I18N_FUNCTION_NAME) {
                    return
                }
            }
            const reg = /\s*[\u4E00-\u9FA5]+\s*/g
            const stringValue = path.node.value
            if (reg.test(stringValue)) {
                path.replaceWith(t.CallExpression(
                    t.identifier(MINA_I18N_FUNCTION_NAME),
                    [t.stringLiteral(stringValue)]
                ))
                createI18NData(stringValue)
            }
        }
    }
    try {
        const result = babel.transform(code, {
            plugins: [
                { visitor }
            ],
            generatorOpts: {
                quotes: 'single',
                compact: false
            }
        })

        const i18nScriptContent = transformText(toSingleQuotes(result.code))
        return i18nScriptContent.replace(/[\r\n]+$/g, '').replace(/^;/g, '').replace(/;$/g, '')
    } catch (e) {
        return code
    }
}

module.exports = {
    createI18NData,
    setI18NData,
    translateToEnglish,
    isSelfCloseTag,
    unicodeToHanzi,
    transformText,
    processMinaTemplateText,
    processPlainText,
    buildWXML,
    prettyJSON,
    processHTMLJson,
    processMinaTemplateExpression
}