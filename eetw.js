"use strict";

var config = require("config");
var geolib = require("geolib");
var Twitter = require("twitter");
var EventEmitter = require("events").EventEmitter;

var twitter = new Twitter(config.TWITTER_API_KEY);
var ee = new EventEmitter();

console.log(config);

// tweet
ee.on("tweet", function(str) {
console.log(tweet);
//    twitter.post("statuses/update", { status: str }, function(error, data, response) {
//        console.log(data.text);
//    });
});

// message filter
ee.on("twitter.push", function(data) {
console.log(data);

    // 所在地と発生地点の比較
    // 範囲外であればスキップ
    var latlon = (data.geo.coordinates) ? { latitude: data.geo.coordinates[1], longitude: data.geo.coordinates[0] } : { latitude: 0, longitude: 0 };
    console.log(latlon);
    if (!geolib.isPointInCircle(latlon, config.QUAKE_FILTER_CIRCLE_CENTER, config.QUAKE_FILTER_CIRCLE_RADIUS)) return;

    var seismic = data.text.match(new RegExp(config.TWITTER_EEW_SEISMIC_MATCH))[1];
    var url = data.entities.urls[0].expanded_url;

    // 震度でツイート内容を変える
    var tweet = config.OPPAI[seismic];
    if (tweet) {
        if (url) tweet += "\n\n" + url;
        ee.emit("tweet", tweet);
    }
});

const sleep = (waitSeconds, someFunction) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(someFunction())
        }, waitSeconds * 1000)
    });
}

// twitter stream
var stream;
var retry = 0;
function twitter_setup() {

    stream = twitter.stream("statuses/filter", config.TWITTER_EEW_ACCOUNT);

    stream.on("data", function(data) {
        retry = 0;
        ee.emit("twitter.push", data);
    });

    stream.on("error", function(err) {
        console.log("error");
        console.log(err);
        if (error.message == 'Status Code: 420') {
            stream.destroy();
            sleep(Math.pow(2, retry) * 30, twitter_setup);
            retry++;
        } else {
            throw err;
        }
    });
}

twitter_setup();

// TEST DATA
// var twitterpush = { "created_at": "Mon Jan 21 14:17:38 +0000 2019", "id": 1087353532414455800, "id_str": "1087353532414455808", "text": "地震速報 2019/01/21 23:17頃、豊後水道の深さ30kmでマグニチュード4.2の地震が発生しました。予想される最大震度は震度5です。 https://t.co/84e3PoiwUe #jishin #earthquake", "truncated": false, "entities": { "hashtags": [{ "text": "jishin", "indices": [97, 104] }, { "text": "earthquake", "indices": [105, 116] }], "symbols": [], "user_mentions": [], "urls": [{ "url": "https://t.co/84e3PoiwUe", "expanded_url": "http://twiple.jp/e/5Jsq772C", "display_url": "twiple.jp/e/5Jsq772C", "indices": [73, 96] }] }, "source": "<a href=\"http://twiple.jp\" rel=\"nofollow\">Twiple!</a>", "in_reply_to_status_id": null, "in_reply_to_status_id_str": null, "in_reply_to_user_id": null, "in_reply_to_user_id_str": null, "in_reply_to_screen_name": null, "user": { "id": 16052553, "id_str": "16052553", "name": "地震速報", "screen_name": "eew_jp", "location": "ナマズの隣", "description": "震度3以上の地震速報を投稿しています。速報値ですので誤差がある場合があります。第1報以降は投稿して いませんので各投稿のリンク先でご確認ください。\r\n緊急、災害時などには手動で必要な情報を投稿する事があります。", "url": "http://t.co/XHMeMTVOm7", "entities": { "url": { "urls": [{ "url": "http://t.co/XHMeMTVOm7", "expanded_url": "http://quake.twiple.jp/", "display_url": "quake.twiple.jp", "indices": [0, 22] }] }, "description": { "urls": [] } }, "protected": false, "followers_count": 90636, "friends_count": 4, "listed_count": 5135, "created_at": "Sat Aug 30 07:36:34 +0000 2008", "favourites_count": 0, "utc_offset": null, "time_zone": null, "geo_enabled": true, "verified": false, "statuses_count": 4007, "lang": "ja", "contributors_enabled": false, "is_translator": false, "is_translation_enabled": false, "profile_background_color": "C0DEED", "profile_background_image_url": "http://abs.twimg.com/images/themes/theme1/bg.png", "profile_background_image_url_https": "https://abs.twimg.com/images/themes/theme1/bg.png", "profile_background_tile": false, "profile_image_url": "http://pbs.twimg.com/profile_images/1278738053/icon_normal.png", "profile_image_url_https": "https://pbs.twimg.com/profile_images/1278738053/icon_normal.png", "profile_link_color": "1DA1F2", "profile_sidebar_border_color": "C0DEED", "profile_sidebar_fill_color": "DDEEF6", "profile_text_color": "333333", "profile_use_background_image": true, "has_extended_profile": false, "default_profile": true, "default_profile_image": false, "following": true, "follow_request_sent": false, "notifications": false, "translator_type": "none" }, "geo": { "type": "Point", "coordinates": [139.7005794, 35.689699] }, "coordinates": { "type": "Point", "coordinates": [35.689699, 139.7005794] }, "place": null, "contributors": null, "is_quote_status": false, "retweet_count": 36, "favorite_count": 20, "favorited": false, "retweeted": false, "possibly_sensitive": false, "lang": "ja" };
// ee.emit("twitter.push", twitterpush);
// ee.emit("tweet", "oppai from aws cloud9\n\nhttps://aws.amazon.com/jp/cloud9/");
