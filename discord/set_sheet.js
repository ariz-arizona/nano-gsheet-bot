const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();

const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY } = process.env;

router.post(`/set_sheet/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, sheet_id, guild_id, user_id } = message;
        const { data } = await supabase.from('sheets').select('sheet_id').eq('server_id', guild_id);
        const { data: dataAdmin } = await supabase.from('users').select('user_id').eq('server_id', guild_id);

        let r = {};
        let msg;

        if (!dataAdmin || !dataAdmin.length) {
            throw new Error("admin not found");
        }
        const admin = dataAdmin[0].user_id;
        if (admin !== parseInt(user_id)) {
            throw new Error("only admin");
        }

        if (!data || !data.length) {
            // создание 
            r = await supabase.from("sheets").insert({ server_id: guild_id, sheet_id });
            if (!r.error) msg = `Успешно обновлен SPREADSHEET_ID https://docs.google.com/spreadsheets/d/${sheet_id}`;
        } else if (data[0].sheet_id === sheet_id) {
            // не обновлять
            msg = `SPREADSHEET_ID уже https://docs.google.com/spreadsheets/d/${sheet_id}`;
        } else {
            // обновление 
            r = await supabase.from("sheets").update({ sheet_id }).eq('server_id', guild_id);
            if (!r.error) msg = `Успешно установлен SPREADSHEET_ID https://docs.google.com/spreadsheets/d/${sheet_id}`;
        }

        if (r.error) msg = r.error.message;

        await sendMsgToDiscord({ content: msg }, `${token}/messages/@original`, 'PATCH');
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;