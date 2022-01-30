const { ETwitterStreamEvent, TweetStream, TwitterApi, ETwitterApiError, UserFollowersV2Paginator } = require("twitter-api-v2")
require('dotenv').config()
const {updateUser, client, getStoredUser, createUser} = require("./database")

const api_key = process.env.API_KEY
const api_key_secret = process.env.API_KEY_SECRET
const bearer = process.env.BEARER_TOKEN
const access_token = process.env.ACCESS_TOKEN
const access_token_secret = process.env.ACCESS_TOKEN_SECRET
const Jedi = process.env.LOGGED_USER_ID

const user = new TwitterApi({
    appKey: api_key,
    appSecret: api_key_secret,
    accessToken: access_token,
    accessSecret: access_token_secret
})

const app = new TwitterApi(bearer)
const rwUser = user.readWrite

class Request{
    constructor({tweetFromID,tweetID,action,text}){
        this.tweetFromID = tweetFromID
        this.tweetID = tweetID
        this.action = action
        this.text = text
    }

    async lookUpUsername(){
        let username = await getUserByID(this.tweetFromID)
        return `@${username}`
    }

    async main(){
        try {
            const action = this.action.toLowerCase()
            if (action === ' question ') {
                try {
                    await this.checkAndUpdate(action)
                    await retweet(Jedi, this.tweetID)
                    await this.broadCast(await getUserByID(this.tweetFromID))
                } catch (e) {
                    console.error(e)
                }
            }else if (action === ' answer ') {
                try {
                    await this.checkAndUpdate(action)
                } catch (e) {
                    console.error(e)
                }
            } else if (action === ' update ') {
               try {
                await retweet(Jedi, this.tweetID)
                await this.broadCast(await getUserByID(this.tweetFromID))
               } catch (e) {
                console.error(e)
               }
            } 
        } catch (e) {
            console.error(e)
        }
    }

    async broadCast(username){
        try {
            const tag = await this.lookUpUsername()
            const uri = `https://twitter.com/${username}/status/${this.tweetID}`
            var article = ''
            const whatArticle = (this.action === ' question ')? article = 'a': article = 'an'
            whatArticle
            const broadCast = `Heads up #DevAudience .. ${tag} just posted ${article} ${this.action} .. Please drop a like, retweet or comment/answer \n ${uri}`
            await postTwit(broadCast)
        } catch (e) {
            console.error(e)
        }
    }

    async checkAndUpdate(act){
        try {
            let username = await getUserByID(this.tweetFromID)
            let user = await getStoredUser({
                client: client,
                db: 'users',
                collection: 'actions',
                Username: username
            })
            const check = (user === null)? 
            await this.addUser(act, username)
            : 
            await this.updateUser(act, username, user)
            check
            console.log('check complete')
        } catch (e) {
            console.error(e)
        }
    }

    async addUser(act, username) {
        if (act === ' question ') {
            try {
                await createUser({
                    client: client,
                    db: 'users',
                    collection:'actions',
                    newDoc: {
                        name: username,
                        userID: this.tweetFromID,
                        question_count: 1,
                        answer_count: 0 
                    }
                })
            } catch (e) {
                console.error(e)
            }
        } else {
            try {
                await createUser({
                    client: client,
                    db: 'users',
                    collection:'actions',
                    newDoc: {
                        name: username,
                        userID: this.tweetFromID,
                        question_count: 0,
                        answer_count: 1 
                    }
                })
            } catch (e) {
                console.error(e)
            }
        }
    }

    async updateUser(act, username, user) {
        if (act === ' question ') {
            try {
                await updateUser({
                    name: username,
                    client: client,
                    collection: 'actions',
                    db: 'users',
                    update: {
                        question_count: parseInt(user.question_count + 1)
                    }
                })
            } catch (e) {
                console.error(e)
            }
        } else {
            try {
                await updateUser({
                    name: username,
                    client: client,
                    collection: 'actions',
                    db: 'users',
                    update: {
                        answer_count: parseInt(user.answer_count + 1)
                    }
                })
            } catch (e) {
                console.error(e)
            }
        }
    }
    
}

async function get_Stream() {
    try {
        let stream = await app.v2.searchStream({"expansions": "author_id", "tweet.fields": "referenced_tweets"})

        /* setTimeout(() => {
            stream.close()
        }, 180000) */
          
        stream.on(
        // Emitted when Node.js {response} is closed by remote or using .close().
        ETwitterStreamEvent.ConnectionClosed,
        () => console.log('Connection has been closed.'),
        )
          
        stream.on(
        // Emitted when a Twitter payload (a tweet or not, given the endpoint).
        ETwitterStreamEvent.Data,
        (eventData) => {
            console.log(`Tweet recieved -> ${eventData.data.text}`)
            const tweeted = eventData.data.text
             
            let screened = checkSemantic(tweeted)
            if (screened === 'right syntax') {
                if (eventData.data.referenced_tweets) {
                    let type = eventData.data.referenced_tweets[0].type
                    if (type === 'retweeted' || type === 'quoted') {
                        console.log(`this is a ${type} tweet`)
                        return    
                    }
                }
                let props = getProperties({str: eventData['data'].text})
                let obj = new Request({
                    tweetFromID: eventData.data.author_id,
                    tweetID: eventData.data.id,
                    action: props[1],
                    text: props[2]
                })
                obj.main()
            }else console.log('tweet not related to community')
        })
          
        stream.on(
        // Emitted when a Twitter sent a signal to maintain connection active
        ETwitterStreamEvent.DataKeepAlive,
        () => console.log('Twitter has a keep-alive packet.'),
        )
          
        // Enable reconnect feature
        stream.autoReconnect = true
    } catch (error) {
        console.log(error)
    }
}

async function getUserByID(ID) {
    try {
        let {data} = await rwUser.v2.user(ID)
        return data.username
    } catch (e) {
        console.error(e)
    }
}

function getProperties({ str }) {
    let arr = []
    arr = str.split('~')
    return arr
}

async function retweet(loggedUser,tweetID) {
    try {
        let rt = await rwUser.v2.retweet(loggedUser, tweetID)
        console.log(rt)
    } catch (e) {
        console.error(e)
    }
}

async function getTweetLikes(tweetID) {
    try {
        let usersThatLiked = await rwUser.v2.tweetLikedBy(tweetID)
        console.log(usersThatLiked.data[usersThatLiked.data.length - 1].username)
    } catch (e) {
        console.error(e)
    }
}

async function postTwit(message) {
    try {
        let data = await rwUser.v2.tweet(message)
        console.log(data.data)
    } catch (error) {
        console.log(error)
    }
}


function checkSemantic(string) {
    let arr = string.split(' ')
    console.log(arr)
    let reply_Or_Not = check_if_reply(arr[0])
    if (reply_Or_Not === 'reply') {
        arr.shift()
        console.log(arr)
    }
    if (arr.includes('~')) {
        let how_many = countInArray(arr, '~')
        if (how_many === 2) {
            if (arr[1] === '~' && arr[3] === '~') {
                return 'right syntax'
            }else {
                return 'incorrect syntax'
            }
        }else {
            return 'incomplete/incorrect syntax'
        }
    }else{
        return 'incorrect syntax'
    }
    function countInArray(array, what) {
        return array.filter(item => item === what).length
    }
}

function check_if_reply(string) {
    let arr = string.split(' ')
    let sub_arr = arr[0].split('')
    if (sub_arr.includes('@')) {
        return 'reply'
    }else {return 'not reply'}
}

get_Stream()
/* let res = checkSemantic('@Mothers__child #DevAudience ~ answer ~ this is an answer ..')
console.log(res) */

// check_if_reply('@Mothers__child #DevAudience ~ answer ~ this is an answer ..')

