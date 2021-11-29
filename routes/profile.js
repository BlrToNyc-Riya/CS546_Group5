const router = require('express').Router();
const { formidable } = require('formidable');
const fs = require('fs');
const userData = require('../data/users');
router.get('/', (_, res) => {
	res.render('profile', { title: 'Profile', showHeader: true, scriptUrl: ['profile.js'] });
});

router.post('/upload', async (req, res) => {
	if (!req.session.userid) {
		res.status(403).send();
		return;
	}

	const form = new formidable.IncomingForm();

	form.parse(req, (err, _, files) => {
		if (err) {
			res.status(500).send('Internal Server Error');
			return;
		}

		try {
			const { newFilename, filepath, originalFilename } = files.avatar;
			const type = originalFilename.match(/\.\w+$/)[0];
			const fileName = `${newFilename}${type}`;
			fs.writeFileSync(`public/img/${fileName}`, fs.readFileSync(filepath));
			const path = `/public/img/${fileName}`;
			(async function () {
				try {
					const editUser = await userData.uploadPic(req.session.userid, path);
				} catch (e) {
					res.status(400).send(e);
				}
			})();

			res.json({ path });
			// TODO: store the path to MongoDB
		} catch (error) {
			res.status(500).send('Internal Server Error');
		}
	});
});

module.exports = router;
