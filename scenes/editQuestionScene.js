const fs = require("fs")
const path = require("path")
const each = require("sync-each")
const { Scenes } = require("telegraf")
const { sendQuestion, getQuestion, editQuestion } = require("../functions")


const questionsFilePath = path.join(__dirname, "..", "questions.json")

const editQuestionScene = new Scenes.BaseScene("editQuestionScene")

editQuestionScene.enter(ctx => {
    if(ctx.scene.session.state.questionNumber) return questionNumberHandler(ctx, ctx.scene.session.state.questionNumber)
    ctx.scene.session.state = { waitingForNewText: false, waitingForNewPhoto: false, waitingForNewDocument: false, waitingForNewButtons: false }
    var questions = JSON.parse(fs.readFileSync(questionsFilePath, "utf-8"))
    var i = 0
    each(questions,
        async function(_, next) {
            await ctx.reply(`${++i}й вопрос:`).catch(err => console.log(err))
            await sendQuestion(i, ctx).catch(err => console.log(err))
            next()
        },
        function() {
            ctx.reply("Какой вопрос по счету хотите отредактировать?", {reply_markup: {inline_keyboard: genNumberKeyboard(questions.length)}}).catch(err => console.log(err))
        }
    )
})

editQuestionScene.action("reenterScene", ctx => ctx.scene.reenter())

editQuestionScene.action("toMainMenu", ctx => {
    ctx.reply("Редактирование вопроса отменено").catch(err => console.log(err))
    return ctx.scene.leave()
})

editQuestionScene.action(/questionNumber/ig, async ctx => await questionNumberHandler(ctx))

async function questionNumberHandler(ctx, questNumber = undefined) {
    var questionNumber = questNumber ?? ctx.callbackQuery.data.replace("questionNumber", "")
    var question = await getQuestion(questionNumber).catch(err => console.log(err))
    var questionHasPhoto = question.photo != undefined
    ctx.scene.session.state = { questionNumber: questNumber ? undefined : questionNumber, waitingForNewText: false, waitingForNewPhoto: false, waitingForNewDocument: false, waitingForNewButtons: false }
    await ctx.reply("Сейчас сообщение выглядит вот так⬇️").catch(err => console.log(err))
    await sendQuestion(questionNumber, ctx).catch(err => console.log(err))
    await ctx.reply("Что хотите изменить?", {reply_markup: {inline_keyboard: [[{text: "Изменить текст", callback_data: `changeText${questionNumber}`}], questionHasPhoto ? [{text: "Заменить фотографию", callback_data: `changePhoto${questionNumber}`}] : [{text: "Заменить документ", callback_data: `changeDocument${questionNumber}`}], [{text: "Изменить кнопки", callback_data: `changeButtons${questionNumber}`}], [{text: "Назад", callback_data: "reenterScene"}]]}}).catch(err => console.log(err))
}

editQuestionScene.action(/changeText/ig, ctx => {
    ctx.scene.session.state.waitingForNewText = true
    ctx.reply("Введите новый текст").catch(err => console.log(err))
})

editQuestionScene.on("text", ctx => {
    if(!ctx.scene.session.state.waitingForNewText) return ctx.reply("Давайте по порядку", {reply_markup: {inline_keyboard: [[{text: "Давайте...", callback_data: ctx?.scene?.session?.state?.questionNumber ? `questionNumber${ctx.scene.session.state.questionNumber}` : "reenterScene"}]]}}).catch(err => console.log(err))
    editQuestion(ctx.scene.session.state.questionNumber, "text", ctx.message.text)
    ctx.reply(`Текст в сообщении изменен на "${ctx.message.text}"`, {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: `questionNumber${ctx.scene.session.state.questionNumber}`}]]}}).catch(err => console.log(err))
    ctx.scene.session.state.waitingForNewText = false
})

editQuestionScene.action(/changePhoto/ig, ctx => {
    ctx.scene.session.state.waitingForNewPhoto = true
    ctx.reply("Отправьте новую фотографию").catch(err => console.log(err))
})

editQuestionScene.on("photo", ctx => {
    if(!ctx.scene.session.state.waitingForNewPhoto) return ctx.reply("Давайте по порядку", {reply_markup: {inline_keyboard: [[{text: "Давайте...", callback_data: ctx?.scene?.session?.state?.questionNumber ? `questionNumber${ctx.scene.session.state.questionNumber}` : "reenterScene"}]]}}).catch(err => console.log(err))
    var photo = ctx.message.photo[ctx.message.photo.length - 1].file_id
    editQuestion(ctx.scene.session.state.questionNumber, "photo", photo)
    ctx.replyWithPhoto(photo, {caption: `Фотография в сообщении изменена на ⬇️`, reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: `questionNumber${ctx.scene.session.state.questionNumber}`}]]}}).catch(err => console.log(err))
    ctx.scene.session.state.waitingForNewPhoto = false
})

editQuestionScene.action(/changeDocument/ig, ctx => {
    ctx.scene.session.state.waitingForNewDocument = true
    ctx.reply("Отправьте новый файл").catch(err => console.log(err))
})

editQuestionScene.on("document", ctx => {
    if(!ctx.scene.session.state.waitingForNewDocument) return ctx.reply("Давайте по порядку", {reply_markup: {inline_keyboard: [[{text: "Давайте...", callback_data: ctx?.scene?.session?.state?.questionNumber ? `questionNumber${ctx.scene.session.state.questionNumber}` : "reenterScene"}]]}}).catch(err => console.log(err))
    var document = ctx.message.document.file_id
    editQuestion(ctx.scene.session.state.questionNumber, "document", document)
    ctx.replyWithDocument(document, {caption: `Документ в сообщении изменена на ⬇️`, reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: `questionNumber${ctx.scene.session.state.questionNumber}`}]]}}).catch(err => console.log(err))
    ctx.scene.session.state.waitingForNewDocument = false
})

editQuestionScene.action(/changeButtons/ig, ctx => ctx.scene.enter("editButtonScene", {questionNumber: ctx.scene.session.state.questionNumber}))

function genNumberKeyboard(amountOfQuestions) {
    const keyboard = []
    var currentArray = [];

    for (var i = 1; i <= amountOfQuestions; i++) {
        currentArray.push({text: i, callback_data: `questionNumber${i}`});

        if (currentArray.length == 2 || i === amountOfQuestions) {
            keyboard.push([...currentArray]);
            currentArray = [];
        }

    }
    keyboard.push([{text: "Отмена", callback_data: "toMainMenu"}])
    return keyboard
}



module.exports = editQuestionScene