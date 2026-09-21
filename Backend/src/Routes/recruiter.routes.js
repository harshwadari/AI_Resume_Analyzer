const { Router } = require('express');
const { authUser } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createAnalysisSchema } = require('../validations/analysis.validations');
const controller = require('../controllers/analysis.controller');

const router = Router();
router.use(authUser);
router.post('/analyses', validate(createAnalysisSchema), controller.createAnalysis);
router.get('/analyses/:analysisId', controller.getAnalysis);
module.exports = router;
