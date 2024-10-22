const Topic = require('../models/topic');

exports.getForum = async (req, res, next) => {
    try {
        let categorySearch;

        if (req.query.category) {
            categorySearch = req.query.category;
        }

        const categories = await Topic.aggregate([
            {
                $unwind: "$category"
            },
            {
                $group: { 
                    _id: "$category" 
                }
            },
            {
                $sort: { 
                    _id: 1 
                }
            }
        ]);

        const mostViewedTopic = await Topic.findOne()
            .sort({ 'views.count': -1 })

        if (categorySearch) {
            const topics = Topic.find({ category: { $in: categorySearch } })
            .then(topics => {
                return res.status(200).render('forum/forum', {
                    path: "/zajednica",
                    pageTitle: "Zajednica",
                    pageDescription: "Pridružite se našoj zajednici ljubitelja kuvanja gde delimo inspiraciju, recepte i savete za sve prilike! Bilo da ste početnik, ljubitelj zdrave ishrane, veganske ili vegetarijanske kuhinje, ili jednostavno tražite brze i ukusne recepte, ovde ćete pronaći sve što vam je potrebno. Učestvujte u diskusijama, podelite svoje ideje i naučite nešto novo svaki dan.",
                    pageKeyWords: "zajednica kuvara, kulinarska zajednica, recepti za početnike, zdrava ishrana, veganska kuhinja, vegetarijanski recepti, kuvanje na budžetu, brzi recepti, recepti za posebne prilike, saveti za kuvanje, kulinarske diskusije",
                    topics: topics,
                    mostViewedTopic: mostViewedTopic,
                    categories: categories
                })
            });  
        } else {
            const topics = Topic.find()
            .then(topics => {
                return res.status(200).render('forum/forum', {
                    path: "/zajednica",
                    pageTitle: "Zajednica",
                    pageDescription: "Pridružite se našoj zajednici ljubitelja kuvanja gde delimo inspiraciju, recepte i savete za sve prilike! Bilo da ste početnik, ljubitelj zdrave ishrane, veganske ili vegetarijanske kuhinje, ili jednostavno tražite brze i ukusne recepte, ovde ćete pronaći sve što vam je potrebno. Učestvujte u diskusijama, podelite svoje ideje i naučite nešto novo svaki dan.",
                    pageKeyWords: "zajednica kuvara, kulinarska zajednica, recepti za početnike, zdrava ishrana, veganska kuhinja, vegetarijanski recepti, kuvanje na budžetu, brzi recepti, recepti za posebne prilike, saveti za kuvanje, kulinarske diskusije",
                    topics: topics,
                    mostViewedTopic: mostViewedTopic,
                    categories: categories
                })
            });        
        }        
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.getTopicById = async (req, res, next) => {
    try {
        const topicId = req.params.topicId;
        const isGuest = !req.session.user;
        const topic = await Topic.findById(topicId);

        if (!isGuest) {
            const loggedUserId = req.session.user._id;

            const isViewed = topic.views.users.find(user => user.userId._id.toString() === loggedUserId.toString());
            const currentDate = new Date();

            if (isViewed) {
                if (isViewed.expiration <= currentDate) {
                    // If time is expired, increment cound and set new expiration
                    topic.views.count += 1;
                    isViewed.expiration = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
                }
            } else {
                topic.views.count += 1;
                topic.views.users.push({
                    userId: loggedUserId,
                    expiration: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
                })
            }

            await topic.save();
        }

        return res.status(200).render('forum/topic', {
            path: "/topic",
            pageTitle: topic.title,
            pageDescription: topic.shortDescription,
            pageKeyWords: topic.pageKeyWords,
            topic: topic,
            isGuest: isGuest
        });
    } catch (err) {
        const error = new Error("Desila se neočekivana greška! " + err);
        error.httpStatusCode = 500;
        return next(error);
    }
}

exports.postTopicComment = (req, res , next) => {
    try {
        const user = req.session.user;
        const topicId = req.body.topicId;
        const content = req.body.content;

        const topic = Topic.findById(topicId)
            .select("comments")
            .then(topic => {
                topic.comments.push({
                    author: {
                        authorId: user._id,
                        username: user.username,
                        userImage: user.userImage
                    },
                    content: content,
                    createdAt: Date.now()
                });

                topic.save()
                    .then(topic => {
                        return res.redirect('/zajednica/'+topic._id);
                    })
            })
    } catch (err) {
        const error = new Error("Desila se neočekivana greška!");
        error.httpStatusCode = 500;
        return next(error);
    }
}