const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();
const { google } = require("googleapis");

const { auth } = require("../functions/helpers");
const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY,
    GOOGLE_API_KEY } = process.env;

router.post(`/bot_add_user/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, userId, username, target: userTarget, guild_id } = message;

        const { data: db_data } = await supabase.from('sheets').select('sheet_id').eq('server_id', guild_id);
        const { data: target_data } = await supabase.from('target').select('target').eq('server_id', guild_id);

        if (!db_data || !db_data.length) {
            throw new Error('no spreadsheet');
        }

        const SPREADSHEET_ID = db_data[0].sheet_id;

        const defaultTarget = (!target_data || !target_data.length) ? 2000 : target_data[0].target;
        const target = (!userTarget || userTarget < defaultTarget) ? defaultTarget : userTarget;

        const sheets = google.sheets({
            version: "v4",
            auth: GOOGLE_API_KEY,
        });
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: "A4:B60",
        });
        const data = res.data.sheets[0].data[0].rowData;
        const findUsernames = data.map((el) => {
            return el.values[0].formattedValue === userId ? el.values[1].formattedValue : '';
        }).filter(String);
        const findFree = data.findIndex((el) => {
            return !el.values[0].formattedValue;
        });

        const rowIndex = { usernames: findUsernames, free: findFree };

        const freeRow = rowIndex.free + 4;
        if (!rowIndex.usernames.includes(username)) {
            const sheets = google.sheets({
                version: "v4",
                auth: GOOGLE_API_KEY,
            });

            const jwt = await auth();

            sheets.spreadsheets.values.update({
                auth: jwt,
                spreadsheetId: SPREADSHEET_ID,
                range: `Список участников!A${freeRow}:D${freeRow}`,
                valueInputOption: "USER_ENTERED",
                resource: { values: [[userId, username, target, 6]] },
            });

            const body = {
                content: [`Пользователь: ${username}`, `Цель: ${target}`].join('\n'),
            };
            await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
        } else {
            const body = {
                content: `В таблице уже есть запись для ${username}`
            }
            await sendMsgToDiscord(body, `${token}/messages/@original`, 'PATCH');
        }
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;