const { createClient } = require("@supabase/supabase-js");
const router = require("express").Router();

const { sendErrorToDiscord, sendMsgToDiscord } = require("./send_msg_func");

const { DISCORD_TOKEN,
    SUPABASE_URL, SUPABASE_KEY } = process.env;

router.post(`/set_admin/${DISCORD_TOKEN}`, async (_req, res) => {
    const message = _req.body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
        const { token, user_id, guild_id } = message;
        const { data } = await supabase.from('users').select('user_id').eq('server_id', guild_id);

        let r = {};
        let msg;

        if (!data.length) {
            // создание 
            r = await supabase.from("users").insert({ server_id: guild_id, user_id });
            if (!r.error) msg = `Успешно обновлен администратор нано-бота <@${user_id}>`;
        } else if (data[0].user_id == user_id) {
            // не обновлять
            msg = `Администратор нано-бота уже <@${user_id}>`;
        } else {
            // обновление 
            r = await supabase.from("users").update({ user_id }).eq('server_id', guild_id);
            if (!r.error) msg = `Успешно установлен администратор нано-бота <@${user_id}>`;
        }

        if (r.error) msg = r.error.message;

        await sendMsgToDiscord({ content: msg }, `${token}/messages/@original`, 'PATCH');
    } catch (error) {
        await sendErrorToDiscord(error, message.token);
    }
    res.sendStatus(200);
});

module.exports = router;