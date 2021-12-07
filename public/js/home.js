const composition = {
	setup() {
		/************************************************************* Auth *************************************************************/
		const userAuth = reactive({
			auth: false,
			userInfo: null
		});
		onMounted(() => {
			const USER_INFO = sessionStorage.getItem('USER_INFO');
			if (USER_INFO) {
				userAuth.auth = true;
				userAuth.userInfo = JSON.parse(USER_INFO);
			} else {
				userAuth.auth = false;
				userAuth.userInfo = null;
			}
		});

		/************************************************************* Post List *************************************************************/
		const pageConfig = reactive({
			pageNumber: 1,
			pageSize: 5
		});
		const show = reactive({
			showMoreDetailIndex: null,
			showComment: null
		});
		const disabledLoad = ref(true);
		const postList = ref([]);
		const loadMorePost = () => {
			pageConfig.pageNumber++;
			getPostList({ ...pageConfig, topicId: currentTopic.value });
		};
		const getPostList = params => {
			http.get('/posts/getPosts', params).then(res => {
				disabledLoad.value = res.length < pageConfig.pageSize;
				postList.value.push(...res.map(item => formatPostDetail(item)));
			});
		};

		const handleLikes = (index, id) => {
			http.post('posts/like', { id }).then(res => {
				postList.value[index].popularity = res;
			});
		};
		const handleSeeMore = (index, id) => {
			show.showMoreDetailIndex = show.showMoreDetailIndex === index ? null : index;
			saveHistory(id);
		};

		/************************************************************* Topics *************************************************************/
		const currentTopic = ref(null);
		onMounted(() =>
			getTopics().then(res => {
				currentTopic.value = res[0]._id;
			})
		);
		watch(currentTopic, newVal => {
			postList.value = [];
			pageConfig.pageNumber = 1;
			getPostList({ ...pageConfig, topicId: newVal });
		});

		/************************************************************* Add Post *************************************************************/
		const showDialog = reactive({ showPostDialog: false });
		const postsForm = ref();
		const postForm = ref(null);
		const createTime = ref(null);
		const selectedTopics = computed(() => TOPICS.value.filter(item => postForm.value.topics.includes(item._id)));
		const openPostDialog = () => {
			postForm.value = new Posts();
			createTime.value = dayjs().format('MM/DD/YYYY');
		};
		const handlePublish = () => {
			postsForm.value.validate(valid => {
				if (valid) {
					http.post('/posts/add', postForm.value).then(msg => {
						ElNotification({ title: 'Success', message: msg, type: 'success' });
						if (postForm.value.topics.includes(currentTopic.value)) {
							postList.value = [];
							getPostList({ pageNumber: 1, pageSize: 5, topicId: currentTopic.value });
						}
						postsForm.value.resetFields();
						showDialog.showPostDialog = false;
					});
				} else {
					return false;
				}
			});
		};

		/************************************************************* Comment *************************************************************/
		const comment = reactive(new Comment());
		const handleSubmitComment = () => {}; // TODO: submit comment

		/************************************************************* Profile *************************************************************/
		const showFriendsList = ref(true);
		const displayName = computed(() => {
			return (
				userAuth.userInfo?.username || `${userAuth.userInfo?.firstname || '--'} ${userAuth.userInfo?.lastname || '--'}`
			);
		});

		/************************************************************* Search *************************************************************/
		const searchTerm = ref('');
		const detailDialog = ref(false);
		const postDetail = ref({});
		const querySearchPost = (queryString, cb) => {
			http.get('/posts/search', { title: queryString }).then(res => {
				cb(res);
			});
		};
		const handlePostSelected = item => {
			const { _id } = item;
			http.get('/posts/getDetail', { id: _id }).then(res => {
				saveHistory(_id);
				postDetail.value = formatPostDetail(res);
				detailDialog.value = true;
			});
		};

		return {
			...toRefs(userAuth),
			showFriendsList,
			...toRefs(showDialog),
			postsForm,
			postForm,
			postRules,
			createTime,
			selectedTopics,
			currentTopic,
			pageConfig,
			disabledLoad,
			postList,
			handleLikes,
			handleSeeMore,
			loadMorePost,
			handlePublish,
			openPostDialog,
			displayName,
			handleLogout,
			...toRefs(show),
			comment,
			handleSubmitComment,
			TOPICS,
			showAddFriendsDialog,
			...toRefs(addFriendsConfig),
			searchTerm,
			detailDialog,
			postDetail,
			querySearchPost,
			handlePostSelected
		};
	}
};

Vue.createApp(composition).use(ElementPlus).mount('#app');
