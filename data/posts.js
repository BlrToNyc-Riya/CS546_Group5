const mongoCollections = require('../config/mongoCollections');
const utils = require('./utils');
const userData = require('./users');
const topicData = require('./topics');
const posts = mongoCollections.posts;
const { ObjectId } = require('mongodb');
const { errorCheckingId } = require('../utils/utils');

async function getMyPosts(id){		//get myposts using req.session.userid as posterID
	if (!id) 
		throw "No Permissipn, please sign in";
	
		const postCollection = await posts();
		let postList = await postCollection.find({ posterId: id},{ projection: { _id: 1, title: 1} }).sort({ 'metaData.timeStamp': 1 }).toArray();
		return postList;
	
}
// Add a post to the Pond
async function getPostsByTitle(title) {
	const postCollection = await posts();
	let postList = await postCollection.find({ title }).sort({ 'metaData.timeStamp': 1 }).toArray();
	postList = await handlePost(postList);
	return postList;
}

const getPosts = async ({ topicId, pageSize, pageNumber }) => {
	if (errorCheckingId(topicId)) throw 'topicId invalid';
	if (isNaN(+pageSize) || isNaN(+pageNumber)) throw 'pageSize or pageNumber invalid';

	const postCollection = await posts();
	let postList = await postCollection
		.find({ topics: { $elemMatch: { $eq: topicId } } })
		.sort({ 'metaData.timeStamp': 1 })
		.skip(+pageNumber - 1)
		.limit(+pageSize)
		.toArray();

	postList = await handlePost(postList);
	return postList;
};

const handlePost = async postList => {
	let res = [];
	for (let post of postList) {
		post.timeStamp = post.metaData.timeStamp;
		const poster = await userData.getUser(post.posterId);
		poster && ['firstname', 'lastname', 'username', 'profilePic'].forEach(item => (post[item] = poster[item]));
		delete post.thread;
		delete post.posterId;
		delete post.metaData;

		res.push(post);
	}

	return res;
};

async function addPost(posterId, title, body, topics) {
	errorCheckingPost(title, body);

	// Check for user
	const sid = utils.objectIdToString(posterId);
	const user = await userData.getUser(sid);
	//if (user === null) throw 'User does not exist';
	var topicTitles = [];
	// Check for topic
	if (topics) {
		if (topics.length > 0 && topics.length < 4) {
			const topicListDB = await topicData.getAllTopics();
			utils.stringToObjectID(topics);
			// const inputTopics = await topicData.getTopicTitles(topics);
			// Iterate and check that each topic is valid
			for (let i = 0; i < topics.length; i++) {
				let userTopic = topics[i];
				let title = await topicData.getTopicbyId(userTopic);
				topicTitles.push(title);
				let topicFlag = true;
				for (let j = 0; j < topicListDB.length && topicFlag; j++) {
					if (topicListDB[j]._id === userTopic) {
						topicFlag = false;
					}
				}
				if (topicFlag) {
					throw 'Topic does not exist';
				}
			}
		}
	}

	// New Post
	const postCollection = await posts();
	const post = {
		title: title,
		body: body,
		posterId: sid,
		topics: topicTitles,
		thread: [],
		popularity: {},
		metaData: {
			timeStamp: new Date().getTime(),
			archived: false,
			flags: 0
		}
	};

	// Check that post was inserted
	const newPostInfo = await postCollection.insertOne(post);
	if (newPostInfo.insertedCount === 0) throw 'Insert failed!';

	let postId = utils.objectIdToString(post._id);
	user.posts.push(postId);

	const userWithPost = await userData.updateUser(user, sid);
	if (!userWithPost) throw 'Post not created for user';

	return post;
}

async function getPost(id) {
	// Get the id as an ObjectId, will return if valid
	let oid = utils.stringToObjectID(id);

	// Look for post in the database
	const postCollection = await posts();
	const post = await postCollection.findOne({ _id: oid });

	// Check if the post was found
	if (post === null) throw 'Post not found';
	post._id = utils.objectIdToString(post._id);

	return post;
}

async function deletePost(id) {
	// Check that post exist
	const sid = utils.objectIdToString(id);
	const postCollection = await posts();
	let post = await this.getPost(sid);

	if (!post) throw 'Post not found';

	// Delete
	const deletionInfo = await postCollection.deleteOne({ _id: id });

	// Check deletion worked
	if (deletionInfo.deletedCount === 0) {
		throw `Could not delete post`;
	}
	return { deleted: true };
}

async function editPost(posterId, postId, title, body, topics) {
	errorCheckingPost(title, body);
	const topicInput = topics;
	// Check for user
	const sidUser = utils.objectIdToString(posterId);
	const user = await userData.getUser(sidUser);
	//if (user === null) throw 'User does not exist';

	// Check if post exist
	const sidPost = utils.objectIdToString(postId);
	const post = await this.getPost(sidPost);
	//if (post === null) throw 'Post does not exist';

	// Check for topic
	if (topics) {
		if (topics.length > 0 && topics.length < 4) {
			const topicListDB = await topicData.getAllTopics();
			// Iterate and check that each topic is valid
			for (let i = 0; i < topics.length; topics++) {
				let userTopic = topics[i];
				let topicFlag = true;
				for (let j = 0; j < topicListDB.length && topicFlag; j++) {
					if (topicListDB[j].title === userTopic) {
						topicFlag = false;
					}
				}
				if (topicFlag) {
					throw 'Topic does not exist';
				}
			}
		}
	}

	// Get the old post and make the edited Post
	// Add the lastEdit field in metaData to
	// show post was modified and when
	const newPost = {
		title: post.title,
		body: body,
		posterId: user._id,
		topics: topics,
		thread: post.thread,
		popularity: post.popularity,
		metaData: {
			timeStamp: post.metaData.timeStamp,
			lastEdit: new Date().getTime(),
			archived: post.metaData.archived,
			flags: post.metaData.flags
		}
	};

	// Check that the content of the posts are not the same
	let equalPost = editComparison(post.body, body, post.topics, topicInput);
	if (!equalPost) throw 'No changes made to the post';

	// Update the pre-existing post
	if (!ObjectId.isValid(postId)) throw 'Id is not a valid ObjectID';
	const postCollection = await posts();
	const updateInfo = await postCollection.updateOne({ _id: postId }, { $set: newPost });

	// Ensure the update was successful
	if (!updateInfo.matchedCount && !updateInfo.modifiedCount) throw 'Update failed';

	return { updated: true };
}

/*
	@updatePopularity: add a user who liked or disliked the post
		id: Unique id of the post
		popularity: 1 (like) -1 (dislike)
		// Needs testing
*/
async function updatePopularity(id, popularity) {
	const postCollection = await posts();
	const post = await postCollection.getPost(id);
	if (post === null) throw 'Post does not exist';
	post.metaData.popularity.id = popularity;
}

function errorCheckingPost(title, body) {
	// Input not provided
	if (!title) throw 'No title provided';
	if (!body) throw 'No post content provided';
	// if (posterId) throw "No user provided";

	// Input not of type string or empty
	if (typeof title !== 'string') throw 'Title is not a string';
	else if (title.trim() === '') throw 'Title is an empty string';
	if (typeof body !== 'string') throw 'Body is not a string';
	else if (body.trim() === '') throw 'Body is an empty string';
	// if (typeof posterId !== 'string') throw "User is not a string";
	// else if (posterId.trim() === "") throw "User is an empty string";

	// Max character 3000
	if (body.length > 3000) throw 'Maximum characters reached';

	return;
}

function editComparison(oldBody, newBody, oldTopics, newTopics) {
	oldTopics.sort();
	newTopics.sort();

	if (oldBody === newBody) {
		for (let i = 0; i < oldTopics.length; i++) {
			if (oldTopics[i] !== newTopics[i]) {
				return false;
			}
		}
	}
	return true;
}

const getAllPosts = async () => {
	const postCollection = await posts();
	const postList = await postCollection.find({}).toArray();

	return utils.objectIdToString(postList);
};

module.exports = {
	addPost,
	getPost,
	deletePost,
	editPost,
	updatePopularity,
	errorCheckingPost,
	editComparison,
	getPostsByTitle,
	getPosts,
	getAllPosts,
	getMyPosts
};
