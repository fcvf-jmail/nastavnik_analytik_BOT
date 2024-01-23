const path = require("path")
require("dotenv").config({path: path.join(__dirname, ".env")})
const { Telegraf, Scenes, session } = require("telegraf")
const bot = new Telegraf(process.env.botToken)
const fetch = require("node-fetch")
const cron = require("node-cron")

const surveyScene = require("./scenes/surveyScene")
const editQuestionScene = require("./scenes/editQuestionScene")
const editButtonScene = require("./scenes/editButtonsScene")
const { getQuestion, getUsers, deleteUser } = require("./functions")
const each = require("sync-each")
const adminsChatId = 5979358506

const stage = new Scenes.Stage([surveyScene, editQuestionScene, editButtonScene])

bot.use(session())
bot.use(stage.middleware())


bot.start(ctx => ctx.replyWithPhoto("AgACAgIAAxkBAAPLZaZqkEi-DeZT7ekWjKeiwsQV90cAAsrUMRuANDFJ8cWGoz5JeFsBAAMCAAN5AAM0BA", {caption: "Вам исполнилось 18 лет?", reply_markup: {inline_keyboard: [[{text: "Да", callback_data: "is18"}, {text: "Нет", callback_data: "isNot18"}]]}}).catch(err => console.log(err)))

bot.action("is18", ctx => ctx.scene.enter("surveyScene"))

bot.action("isNot18", ctx => ctx.reply("Спасибо за желание участвовать в программе «Разумный инвестор», однако участие в ней могут принимать только граждане РФ, достигшие 18 лет. Хорошего дня!").catch(err => console.log(err)))

bot.command("editQuestion", ctx => {
    if(ctx.from.id != adminsChatId) return
    ctx.scene.enter("editQuestionScene")
})

bot.on("photo", ctx => ctx.reply(ctx.message.photo[ctx.message.photo.length - 1].file_id))

bot.action("mem", ctx => {  
    ctx.editMessageMedia({type: "photo", media: "AgACAgIAAxkBAAIPLWWfy5OOPxU70gpwwqt6CU7DrX_QAAKw0TEbRJD5SMHUmR_mRmz0AQADAgADeQADNAQ", caption: "fdsf"}, {reply_markup: {inline_keyboard: [[{text: "lol", callback_data: "lol"}]]}})
})
bot.on("document", ctx => ctx.reply(ctx.message.document.file_id))

bot.action(/.*/ig, async ctx => {
    var keyboard = (await getQuestion(10)).keyboard
    var currencyButton = keyboard[0][0]
    var stockButton = keyboard[1][0]

    if(ctx.callbackQuery.data == currencyButton.callback_data) {
        var res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {method: "get"})
        var { USD, EUR, KZT, BYN } = (await res.json()).Valute
        var text = `USD - RUB = ${USD.Value}\nEUR - RUB = ${EUR.Value}\nKZT - RUB = ${KZT.Value}\nBYN - RUB = ${BYN.Value}`
        var reply_markup = {inline_keyboard: [[stockButton]]}
        await ctx.editMessageText(text, {reply_markup}).catch(async err => {
            await ctx.reply(text, {reply_markup}).catch(err => console.log(err))
        })
    }

    if(ctx.callbackQuery.data == stockButton.callback_data) {
        const response = await fetch(`https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/.json`);
        const data = await response.json();
        var sber = (data.securities.data.find(x => x[0] == "SBER"))[3]
        var yandex = (data.securities.data.find(x => x[0] == "YNDX"))[3]
        var gazprom = (data.securities.data.find(x => x[0] == "GAZP"))[3]
        var tinkoff = (data.securities.data.find(x => x[0] == "TCSG"))[3]
        var text = `Sber: ${sber}\nYandex: ${yandex}\nGazprom: ${gazprom}\nTinkoff: ${tinkoff}`
        var reply_markup = {inline_keyboard: [[currencyButton]]}
        await ctx.editMessageText(text, {reply_markup}).catch(async err => {
            await ctx.reply(text, {reply_markup}).catch(err => console.log(err))
        })
    }
})

cron.schedule("* * * * *", async() => {
    each(await getUsers(), async (user, next) => {
        var timeToPing = user.time + 30 * 60 * 1000
        var nowTime = new Date().getTime()
        if(timeToPing >= nowTime) return await next()
        await bot.telegram.sendMessage(user.chatId, "Пожалуйста, закончите регистрацию и получите подарок").catch(err => console.log(err))
        await deleteUser(user.chatId)
        await next()
    })
})

bot.launch()
