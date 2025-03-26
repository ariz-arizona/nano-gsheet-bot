const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();
const fetch = require("@vercel/fetch")(require("cross-fetch"));
const {
    InteractionResponseFlags,
} = require("discord-interactions");
const { google } = require("googleapis");

const { getPath, getPreviousDay, rows } = require("../functions/helpers");

const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY,
    GOOGLE_API_KEY } = process.env;

router.post(`/bot_add/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, words, userId, username, comment, day, guild_id } = message;

        const { data: db_data } = await supabase.from('sheets').select('sheet_id').eq('server_id', guild_id);

        if (!db_data.length) {
            throw new Error('no spreadsheet');
        }

        const SPREADSHEET_ID = db_data[0].sheet_id;

        const originalMsgRaw = await sendMsgToDiscord(false, `${token}/messages/@original`, 'GET');
        const originalMsg = await originalMsgRaw.json();

        const sheets = google.sheets({
            version: "v4",
            auth: GOOGLE_API_KEY,
        });
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: "A1:AJ60",
        });
        const timezone = {
            timeZone: "Europe/Moscow",
            hour12: false,
            day: 'numeric',
            month: 'numeric'
        };

        const currentDayArr = new Date().toLocaleString("en-US", timezone).split('/');
        const currentDay = {
            month: parseInt(currentDayArr[0]),
            day: parseInt(currentDayArr[1])
        };

        const previousDayArr = getPreviousDay().toLocaleString("en-US", timezone).split('/');
        const previousDay = {
            month: parseInt(previousDayArr[0]),
            day: parseInt(previousDayArr[1])
        };
        const data = res.data.sheets[0].data[0].rowData;

        const findUsernames = data.map((el, index) => {
            return el.values[0].formattedValue === userId ? { name: el.values[1].formattedValue, index } : '';
        }).filter(String);

        if (!findUsernames.length) {
            throw new Error(`user not found|${userId}`);
        }

        const gSheetsBaseDate = new Date(1899, 11, 30, 10).getTime();

        const result = [];
        // console.log({ findUsernames, data })
        // console.log(data)
        findUsernames.map(el => {
            const { index: findIndex, name } = el;
            const freeDates = [];
            data[findIndex].values.map((el, i) => {
                // console.log({ i, data: data[0].values[i] })
                const date = data[0].values[i].formattedValue;
                const effValue = data[0].values[i].effectiveValue.numberValue;
                const parsedDate = new Date(gSheetsBaseDate + effValue * 24 * 60 * 60 * 1000);
                const value = data[findIndex].values[i].formattedValue;
                const condition = (
                    parsedDate.getDate() === currentDay.day
                    && (parsedDate.getMonth() + 1) === currentDay.month
                ) || (
                        parsedDate.getDate() === previousDay.day
                        && (parsedDate.getMonth() + 1) === previousDay.month
                    );

                if (i > 0 && condition) {
                    // console.log({ cell: `${rows[i]}${findIndex + 1}`, date });
                    freeDates.push({
                        value: [`${rows[i]}${findIndex + 1}`, date].join('_'),
                        label: `${date}${value ? ` (сейчас слов ${value})` : ''}`,
                        style: parseInt(date) === currentDay ? 1 : 2
                    });
                }
            });
            // console.log(freeDates)
            result.push({ name, dates: freeDates });
        })

        let freeDates = result;

        if (username) {
            freeDates = freeDates.filter(el => el.name === username);
        }

        let currentHour = parseInt(new Date().toLocaleString("en-US", {
            timeZone: "Europe/Moscow",
            hour12: false,
            hour: 'numeric'
        }));
        if (currentHour === 24) currentHour = 0;

        const buttonsArray = [];

        for (let index = 0; index < freeDates.length; index++) {
            const buttons = [];

            let dates = [...freeDates[index].dates];
            const name = freeDates[index].name;

            dates.map((el) => {
                el.value = [el.value, words].join("_");
                el.label = `${el.label} (${name})`
            });

            const yesterdayReportCondition = (words !== 'В' && currentHour >= 10 && dates.length > 1);
            if (yesterdayReportCondition) {
                dates.shift();
            }
            if (dates[0]) {
                buttons.push({
                    type: 2,
                    style: dates[0].style,
                    label: dates[0].label,
                    custom_id: `free_date_${dates[0].value}_${originalMsg.id}`,
                });
            }
            if (dates[1]) {
                buttons.push({
                    type: 2,
                    style: dates[1].style,
                    label: dates[1].label,
                    custom_id: `free_date_${dates[1].value}_${originalMsg.id}`,
                });
            }

            if (buttons.length) buttonsArray.push({
                type: 1,
                components: buttons,
            })
        }
        const txt = buttonsArray.length ?
            [
                `Пользователь: ${freeDates.map(el => el.name).join(', ')}`,
                `Слов: ${words}`,
            ] :
            ['Свободных дат не найдено'];

        if (buttonsArray.length) {
            if (comment) {
                txt.push(`Комментарий: ${comment || ''}`);
            }
            txt.push(`Укажите дату:`);
        }

        if (day && ['yesterday', 'today'].includes(day)) {
            const dates = [...freeDates[0].dates];
            const name = freeDates[0].name;
            const yesterdayReportCondition = (words !== 'В' && currentHour >= 10 && dates.length > 1);
            const body = {
                token,
                _comment: comment || false,
                username: name,
                date: day,
                words: words,
            };

            if (day === 'today') {
                body.cell = dates[dates.length - 1].value.split('_')[0];
            } else if (day === 'yesterday' && !yesterdayReportCondition) {
                body.cell = dates[0].value.split('_')[0];
            } else if (day === 'yesterday' && yesterdayReportCondition) {
                throw new Error('no words yesterday');
            }

            await fetch(`${getPath(_req)}/bot_add_two/${DISCORD_TOKEN}`, {
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...body, guild_id }),
            });
        } else {
            const body = {
                flags: InteractionResponseFlags.EPHEMERAL,
                content: txt.join('\n'),
                components: buttonsArray
            };

            await sendMsgToDiscord(body, token);
        }

    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;