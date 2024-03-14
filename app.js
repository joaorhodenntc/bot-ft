const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = '6323285955:AAFYiFWnG0aLKmhxFD-orRu7KwmXhjJ7gUY'
const chat_bot = '-1002011266973'
const chat_error = '-1002091913296'
const bot = new TelegramBot(token, { polling: false });
const app = express();

async function obterPartidas() {
    const url = "https://apiv3.apifootball.com/?action=get_events&match_live=1&APIkey=c16ba32e0dd38a8ef4b4c90a570d380f0665716e4b214e3715a2448fce6d7656";
    const response = await axios.get(url);
    return response.data;
}

async function obterOdds(idPartida){ 
    const url = `https://apiv3.apifootball.com/?action=get_odds&APIkey=c16ba32e0dd38a8ef4b4c90a570d380f0665716e4b214e3715a2448fce6d7656&match_id=${idPartida}`
    const response = await axios.get(url);
    return response.data;
}

async function enviarMensagemTelegram(chat_id, mensagem) {
    try {
        await bot.sendMessage(chat_id, mensagem, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Erro ao enviar mensagem para o Telegram:', error);
    }
}

const partidasEmAnalise = new Set();
const partidasNotificadas = new Set();
var qtdPartidas = 0;

async function analisarPartidas(){
    const dados = await obterPartidas();
    qtdPartidas = dados.length;
    for(let i=0; i<qtdPartidas; i++){
        const nomeHome = dados[i].match_hometeam_name;
        const nomeAway = dados[i].match_awayteam_name;
        if(dados[i].match_status!='Finished' && dados[i].match_status>=65 && dados[i].match_status<=77){
            const dangerousAttacks = dados[i].statistics.find(stat => stat.type === 'Dangerous Attacks');
            partidasEmAnalise.add(`${nomeHome} x ${nomeAway}`);
            if(dangerousAttacks){
                const apHome = dangerousAttacks.home; 
                const apAway = dangerousAttacks.away;
                const minutes = dados[i].match_status;
                const idPartida = dados[i].match_id;
                if((apHome/minutes>=1 || apAway/minutes>=1) && !partidasNotificadas.has(idPartida)){
                    const scoreHome = dados[i].match_hometeam_score;
                    const scoreAway = dados[i].match_awayteam_score;
                    try{
                        const odds = await obterOdds(idPartida);
                        const oddHome = odds[4].odd_1;
                        const oddAway = odds[4].odd_2;
                        if(oddHome<=1.40 || oddAway<= 1.40){
                            const mensagem = `*${nomeHome}* vs *${nomeAway}*\n\n⚽ Placar: ${scoreHome} x ${scoreAway}\n⚔️ Ataques Perigosos: ${apHome >= 65 ? '*' + apHome + '* 🔥' : apHome} x ${apAway >= 65 ? '*' + apAway + '* 🔥' : apAway}\n📈 Odds Pré: ${oddHome <= 1.40 ? oddHome + ' 👑' : oddHome} x ${oddAway <= 1.40 ? oddAway + ' 👑' : oddAway}\n🕛 Tempo: ${minutes}\n\n🤖 *Entrar em OVER GOL*`;
                            await enviarMensagemTelegram(chat_bot,mensagem);
                            console.log(mensagem);
                            partidasNotificadas.add(idPartida);
                        }
                    } catch (error){
                    }
                }
            } 
        } else {
            partidasEmAnalise.delete(`${nomeHome} x ${nomeAway}`);
        }
    }
}

analisarPartidas()

setInterval(iniciar, 60000);

async function iniciar() {
    try {
        await analisarPartidas();
        console.log(qtdPartidas + " Jogos ao vivo,"+" Analisando " + partidasEmAnalise.size + " Partidas," + " Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]");
    } catch (error) {
        console.log(error)
        await enviarMensagemTelegram(chat_error,error)
    }
}

const port = process.env.PORT || 3333; 

app.get('/ft', (req, res) => {
    const horaAtual = new Date().toLocaleString();
    res.send("<b>BOT FT</b><br>"+ " 🚨 "+ qtdPartidas + " Jogos ao vivo<br>"+" 🤖 Analisando " + partidasEmAnalise.size + " Partidas<br>" + " 💾 Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]<br>" + " ⏰ Hora atual: " + horaAtual);
});

app.get('/ft/aovivo', (req, res) => {
    const nomesDosTimes = [...partidasEmAnalise]; // Convertendo o Set para um array
    res.send(nomesDosTimes);  
});

// Inicie o servidor para ouvir na porta especificada
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
