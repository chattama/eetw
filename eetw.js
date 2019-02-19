"use strict";

const config = require("config");
const geolib = require("geolib");
const Twitter = require("twitter");
const EventEmitter = require("events").EventEmitter;

const twitter = new Twitter(config.TWITTER_API_KEY);
const ee = new EventEmitter();

const sleep = (sec, func) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(func())
        }, sec * 1000)
    });
}

// tweet
ee.on("tweet", (tweet) => {
    if (true) return;
    if (config.DEBUG) {
        console.log("DEBUG tweet");
        console.log(tweet);
        return;
    }
    twitter.post("statuses/update", tweet, (error, data, response) => {
        console.log("statuses/update");
        console.log(error);
        console.log("----------");
        console.log(data);
        console.log("----------");
    });
});

const tweet_data = (json) => {
    let {
        "id_str": id_str,
        "text": text = "",
        "user": {
            "id_str": uid = "",
            "screen_name": screen_name = ""
        },
        "entities": {
            "urls": [
                { "expanded_url": url = null } = {}
            ]
        },
        "geo": geo = { "coordinates": [0, 0] }
    } = json;
    let { "coordinates": lonlat = [0, 0] } = (!geo) ? {} : geo;
    let latlon = { latitude: lonlat[1], longitude: lonlat[0] };
    return {
        id_str: id_str,
        text: text,
        url: url,
        geo: geo,
        uid: uid,
        screen_name: screen_name,
        latlon: latlon
    };
}

// message filter
ee.on("twitter.push", (data) => {

    // exclude rt
    if (data["user"]["id_str"] != config.TWITTER_EEW_ACCOUNT.follow) return;

    let {
        id_str: id_str,
        text: text,
        url: url,
        geo: geo,
        uid: uid,
        screen_name: screen_name,
        latlon: latlon
    } = tweet_data(data);

    console.log(text);
    console.log(url);
    console.log(latlon);

    // 所在地と発生地点の比較
    // 範囲外であればスキップ
    //    if (!geolib.isPointInCircle(latlon, config.QUAKE_FILTER_CIRCLE_CENTER, config.QUAKE_FILTER_CIRCLE_RADIUS)) return;

    let m = data.text.match(new RegExp(config.TWITTER_EEW_SEISMIC_MATCH));
    let [anytext = null, seismic = null] = (m == null) ? [] : m;
    console.log(m);
    console.log("seismic=" + seismic);

    // 震度でツイート内容を変える
    let tweet = {
        status: config.OPPAI[seismic],
        //        attachment_url : url,
        attachment_url: `https://twitter.com/${screen_name}/status/${id_str}`,
        in_reply_to_status_id: id_str
    };

    if (tweet.status) {
        tweet.status += "テスト";
        console.log(tweet);
        ee.emit("tweet", tweet);
    }
});

// statistics
ee.on("twitter.statistics", (data) => {

});

// twitter stream
let stream;
let retry = 0;
const twitter_setup = () => {

    console.log("statuses/filter");
    console.log(config.TWITTER_EEW_ACCOUNT);
    stream = twitter.stream("statuses/filter", config.TWITTER_EEW_ACCOUNT);

    stream.on("data", (data) => {
        retry = 0;
        ee.emit("twitter.push", data);
        ee.emit("twitter.statistics", data);
    });

    stream.on("error", (err) => {
        console.log(err);
        if (err.message == "Status Code: 420") {
            stream.destroy();
            sleep(Math.pow(2, retry) * 30, twitter_setup);
            retry++;
        }
        else {
            throw err;
        }
    });
};

twitter_setup();


if (config.DEBUG) {
    config.TESTDATA.forEach((data, idx) => {
        ee.emit("twitter.push", data);
    });
}
