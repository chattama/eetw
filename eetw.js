"use strict";

const config = require("config");
const geolib = require("geolib");

const EventEmitter = require("events").EventEmitter;
const ee = new EventEmitter();

const Twitter = require("twitter");
const twitter = new Twitter(config.TWITTER_API_KEY);

const JsonDB = require("node-json-db");
const db = new JsonDB("eew_statistics", true, true);

const sleep = (sec, func, ...args) => {
    return new Promise(resolve => {
        setTimeout((args) => {
            resolve(func(args))
        }, sec * 1000, args)
    });
}

// tweet
ee.on("tweet", (tweet) => {
    console.log("===== tweet =====");
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

const eew_match = (str, regex) => {
    let m = str.match(new RegExp(regex));
    let [anytext = null, ret = null] = (m == null) ? [] : m;
    return ret;
};

// EEW tweet expand
const tweet_data = (data) => {

    let {
        "id": id,
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
    } = data;

    let { "coordinates": lonlat = [0, 0] } = (!geo) ? {} : geo;
    let latlon = { latitude: lonlat[1], longitude: lonlat[0] };

    let place = eew_match(data.text, config.TWITTER_EEW_PLACE_MATCH);
    let depth = eew_match(data.text, config.TWITTER_EEW_DEPTH_MATCH);
    let magnitude = eew_match(data.text, config.TWITTER_EEW_MAGNITUDE_MATCH);
    let seismic = eew_match(data.text, config.TWITTER_EEW_SEISMIC_MATCH);

    return {
        id: id,
        id_str: id_str,
        text: text,
        url: url,
        geo: geo,
        uid: uid,
        screen_name: screen_name,
        latlon: latlon,
        place: place,
        depth: depth,
        magnitude: magnitude,
        seismic: seismic
    };
};

// message filter
ee.on("twitter.push", (data) => {
    console.log("===== twitter.push =====");

    // exclude rt
    if (data["user"]["id_str"] != config.TWITTER_EEW_ACCOUNT.follow) return;

    let {
        id_str: id_str,
        text: text,
        url: url,
        geo: geo,
        uid: uid,
        screen_name: screen_name,
        latlon: latlon,
        seismic: seismic
    } = tweet_data(data);

    console.log("text=" + text);
    console.log("url=" + url);
    console.log("latlon=" + JSON.stringify(latlon));
    console.log("seismic=" + seismic);

    // 所在地と発生地点の比較
    // 範囲外であればスキップ
    //    if (!geolib.isPointInCircle(latlon, config.QUAKE_FILTER_CIRCLE_CENTER, config.QUAKE_FILTER_CIRCLE_RADIUS)) return;

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
    console.log("===== twitter.statistics =====");

    // exclude rt
    if (data["user"]["id_str"] != config.TWITTER_EEW_ACCOUNT.follow) return;

    // EEWからn秒後までのツイートを取得
    sleep(60 * 5, ([data]) => {
        console.log("===== statistics =====");

        let {
            id_str: id_str,
            url: url,
            place: place,
            depth: depth,
            magnitude: magnitude,
            seismic: seismic
        } = tweet_data(data);

        let option = {
            count: 200,
            trim_user: true,
            exclude_replies: true,
            since_id: id_str
        };

        twitter.get("statuses/home_timeline.json", option, (error, data, response) => {
            let count = 0;
            data.forEach((tweet) => {
                if (tweet.text.match(/揺れ|ゆれ/)) count++;
            });
            console.log(`${url},${place},${depth}km,M${magnitude},震度${seismic},${count}`);
            db.push(`/${id_str}`, {
                id_str: id_str,
                url: url,
                place: place,
                depth: depth,
                magnitude: magnitude,
                seismic: seismic,
                count: count
            });
        });

    }, data);
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
        ee.emit("twitter.statistics", data);
    });
}
