const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();

const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY } = process.env;

router.post(`/set_target/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, target, guild_id, user_id } = message;
        const { data } = await supabase.from('target').select('target').eq('server_id', guild_id);
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
            r = await supabase.from("target").insert({ server_id: guild_id, target });
            if (!r.error) msg = `Успешно обновлена цель. Теперь слов: ${target}`;
        } else if (data[0].target === target) {
            // не обновлять
            msg = `Цель уже ${target}`;
        } else {
            // обновление 
            r = await supabase.from("target").update({ target }).eq('server_id', guild_id);
            if (!r.error) msg = `Успешно установлена цель. Теперь слов: ${target}`;
        }

        if (r.error) msg = r.error.message;

        await sendMsgToDiscord({ content: msg }, `${token}/messages/@original`, 'PATCH');
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;