const chalk = require("chalk");
const figlet = require("figlet");
const inquirer = require("inquirer");
const request = require("@i-scrapper/plugins-request");

const questions = [
    {
        type: "input",
        name: "authorization",
        message: color("Authorization keys:"),
        prefix: `${color("[", "cyanBright")}+${color("]", "cyanBright")}`,
        suffix: "~",
        validate: function (input) {
            const done = this.async();
            if (!input) {
                done('You need to provide Authorization keys');
                return false;
            }
            let authParse;
            try {
                authParse = JSON.parse(input);
            } catch (error) {
                authParse = error.message;
            }
            if (typeof authParse != "object") {
                done("You need to provide Authorization keys as Object");
                return false;
            }
            return done(null, true);
        },
    },
    {
        type: "list",
        name: "round",
        message: color("Authorization keys taken at 'Round':"),
        prefix: `${color("[", "blueBright")}+${color("]", "blueBright")}`,
        suffix: "~",
        choices: ["Stage 1", "Stage 2", "Stage 3 (WINNER)"],
        filter: (value) => {
            return {
                "Stage 1": 1,
                "Stage 2": 2,
                "Stage 3 (WINNER)": 3,
            }[value];
        },
    },
    {
        type: "input",
        name: "interval",
        message: color("Interval Delay:"),
        prefix: `${color("[", "blueBright")}+${color("]", "blueBright")}`,
        suffix: "~",
        default: 7500,
        validate: function (input) {
            const done = this.async();
            if (input && isNaN(input)) {
                done('You need to provide a number');
                return false;
            }
            return done(null, true);
        },
    }
];

const asciiText = figlet.textSync("Iruz-Xploit", {
    font: 'Graffiti',
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true
});
console.log(color(asciiText, "blueBright"));

inquirer.prompt(questions)
    .then(async ({ authorization, round, interval }) => {
        const authParse = JSON.parse(authorization);
        iStumble(interval, round, authParse);
    });

function iStumble(interval, round, authorization) {
    setInterval(async function iStumble() {
        try {
            const { data } = await stageRequest(authorization, round);
            if (typeof data == "string" && data.includes("BANNED")) {
                console.error(color("BANNED", "cyanBright"));
            } else if (typeof data == "object") {
                const date = new Date();
                let { Id, Username, Country, Region, Crowns, SkillRating } = data.User;
                const print = `[${color(date.getHours())}:${date.getMinutes()}] ` + [color(Id, "cyanBright"), color(Username, "cyanBright"), color(Country, "redBright"), color(Region, "blueBright"), color(Crowns, "cyanBright"), color(SkillRating, "redBright")].join(" > ");
                console.log(print);
            }
        } catch (error) {}
    }, Number(interval));
}

function color(text, color) {
    return color ? chalk[color].bold(text) : chalk.red.bold(text);
}

function stageRequest(authorization, round) {
    return new Promise((resolve, reject) => {
        request({
            url: `http://kitkabackend.eastus.cloudapp.azure.com:5010/round/finishv2/${round}`,
            headers: {
                Authorization: JSON.stringify(authorization),
                use_response_compression: true,
                "Accept-Encoding": "gzip",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64))",
            }
        })
            .then((response) => {
                resolve(response);
            })
            .catch(reject);
    });
}
