const { Scenes } = require("telegraf");
const { getQuestion, editQuestion } = require("../functions");

const editButtonScene = new Scenes.BaseScene("editButtonScene")

editButtonScene.enter(ctx => {
    ctx.scene.session.state.waitingForText = false
    ctx.reply("Что хотите сделать?", {reply_markup: {inline_keyboard: [[{text: "Добавить кнопку", callback_data: "addButton"}], [{text: "Удалить кнопку", callback_data: "deleteButton"}], [{text: "Назад", callback_data: `questionNumber${ctx.scene.session.state.questionNumber}`}]]}})
})

editButtonScene.action(/questionNumber/ig, ctx => ctx.scene.enter("editQuestionScene", {questionNumber: ctx.scene.session.state.questionNumber}))

editButtonScene.action("toSceneEnter", ctx => ctx.scene.reenter({questionNumber: ctx.scene.session.state.questionNumber}))

editButtonScene.action("deleteButton", async ctx => {
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    if(keyboard.length == 0) return ctx.reply("Сейчас не добавлено никаких кнопок", {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: "toSceneEnter"}]]}})

    var keyboardStructure = "[] - один ряд. Сейчас у кнопок следующая структура:\n";
    var keyboardToSend = []

    keyboard.forEach(row => {
        keyboardStructure += "["
        var keyboardRow = []
        row.forEach(button => {
            keyboardStructure += `"${button.text}", `
            keyboardRow.push({text: button.text, callback_data: `removeButton${button.callback_data}`})
        });
        keyboardStructure = keyboardStructure.substring(0, keyboardStructure.length - 2)
        keyboardToSend.push(keyboardRow)
        keyboardStructure += "]\n";
    });
    
    keyboardToSend.push([{text: "Назад", callback_data: "toSceneEnter"}])
    keyboardStructure += "\nКакую кнопку удалить?"

    ctx.reply(keyboardStructure, {reply_markup: {inline_keyboard: keyboardToSend}})
})

editButtonScene.action(/removeButton/ig, async ctx => {
    var buttonToRemove = ctx.callbackQuery.data.replace("removeButton", "")
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    for (var row of keyboard) {
        const index = row.findIndex(btn => btn.callback_data == buttonToRemove);
        if (index === -1 && !row[0].request_contact) continue
        row.splice(index, 1);
        break
    }
    keyboard = keyboard.filter(row => row.length > 0);
    await editQuestion(ctx.scene.session.state.questionNumber, "keyboard", keyboard)
    await ctx.reply(`Кнопка успешно удалена`, {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: "deleteButton"}]]}})
})

editButtonScene.action("addButton", async ctx => {
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    if(keyboard?.[0]?.[0]?.request_contact) return await ctx.reply(`Вы уже добавил кнопку "➡️Поделиться номером телефона⬅️", вместе с ней не может стоять никаких кнопок`, {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: "toSceneEnter"}]]}})
    await ctx.reply("Введите название кнопки", {reply_markup: {inline_keyboard: [[{text: `"➡️Поделиться номером телефона⬅️"`, callback_data: "phoneButton"}], [{text: "Назад", callback_data: "toSceneEnter"}]]}})
    ctx.scene.session.state.waitingForText = true
})

editButtonScene.action("phoneButton", async ctx => {
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    if(keyboard.length != 0) return await ctx.reply(`Вы уже добавил другие кнопки, а кнопка "➡️Поделиться номером телефона⬅️", может стоять вместе с другими кнопками`, {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: "addButton"}]]}})
    await editQuestion(ctx.scene.session.state.questionNumber, "keyboard", [[{text: "➡️Поделиться номером телефона⬅️", request_contact: true}]])
    ctx.scene.session.state.waitingForText = false
    await ctx.reply(`Кнопка "➡️Поделиться номером телефона⬅️" добавлена`, {reply_markup: {inline_keyboard: [[{text: "Назад", callback_data: "toSceneEnter"}]]}})
})

editButtonScene.on("text", async ctx => {
    if(!ctx.scene.session.state.waitingForText) return ctx.reply("Давайте по порядку", {reply_markup: {inline_keyboard: [[{text: "Давайте...", callback_data: "toSceneEnter"}]]}})
    ctx.scene.session.state.waitingForText = false
    
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    
    if (keyboard.length != 0) {
        const rows = keyboard.map((_, idx) => [{ text: `Ряд ${idx + 1}`, callback_data: `Text${ctx.message.text}selectRow${idx + 1}` }]);
        rows.push([{ text: `Ряд ${keyboard.length + 1}`, callback_data: `Text${ctx.message.text}selectRow${keyboard.length + 1}` }], [{ text: "Назад", callback_data: "toSceneEnter" }]);
        return ctx.reply(`Выберите на какой ряд добавить кнопку "${ctx.message.text}"`, { reply_markup: { inline_keyboard: rows } });
    }

    await addButton(ctx, keyboard)
})

editButtonScene.action(/selectRow/ig, async ctx => {
    var [ text, row ] = ctx.callbackQuery.data.replace("Text", "").split("selectRow")
    var keyboard = (await getQuestion(ctx.scene.session.state.questionNumber)).keyboard
    await addButton(ctx, keyboard, row - 1, text)
})

async function addButton(ctx, keyboard, row = 0, text = undefined) {
    var text = text ?? ctx.message?.text
    var button = { text, callback_data: text }
    console.log("row: " + row)
    console.log("before")
    console.log(keyboard)
    if(row > keyboard?.length - 1) keyboard.push([button])
    else keyboard[row].push(button)
    console.log("after")
    console.log(keyboard)
    await editQuestion(ctx.scene.session.state.questionNumber, "keyboard", keyboard);
    ctx.reply(`Кнопка "${text}" успешно добавлена`, { reply_markup: { inline_keyboard: [[{ text: "Назад", callback_data: "addButton" }]] } });
}

module.exports = editButtonScene