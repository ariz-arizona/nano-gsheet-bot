const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();
const { google } = require("googleapis");

const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY,
    GOOGLE_API_KEY } = process.env;

router.post(`/bot_stat/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, userId, guild_id, } = message;

        const { data: db_data } = await supabase.from('sheets').select('sheet_id').eq('server_id', guild_id);

        if (!db_data.length) {
            throw new Error('no spreadsheet');
        }

        const SPREADSHEET_ID = db_data[0].sheet_id;

        const sheets = google.sheets({
            version: "v4",
            auth: GOOGLE_API_KEY,
        });
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: "A4:AO60",
        });

        const data = res.data.sheets[0].data[0].rowData;

        const findUsernames = data.map((el, index) => {
            return el.values[0].formattedValue === userId ? index : '';
        }).filter(String);

        if (!findUsernames.length) {
            throw new Error(`user not found|${userId}`);
        }

        const values = findUsernames.map(el => data[el].values.map((el) => el.formattedValue));

        const text = [];

        values.map(el => {
            const l = el.length;
            const item =
                el && el.length > 1
                    ? [
                        `**${el[1]}**, цель: ${el[2]}, в среднем ${el[l - 5]}`,
                        `Всего написано ${el[l - 4]}, до цели осталось ${el[l - 3]}`,
                        `Выходных: ${el[l - 2]}, пропусков: ${el[l - 1]}`,
                    ]
                    : [`Ничего не найдено для ${userId}`];
            text.push(item.join('\n'));
        });

        const body = {
            content: text.join("\n\n"),
        };
        await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;