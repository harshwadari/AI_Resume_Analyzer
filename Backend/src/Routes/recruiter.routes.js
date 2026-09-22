const { Router } = require('express');
const { authUser } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createAnalysisSchema } = require('../validations/analysis.validations');
const controller = require('../controllers/analysis.controller');

const router = Router();
router.use(authUser);
router.post('/analyses', validate(createAnalysisSchema), controller.createAnalysis);
router.post('/analyses/pdf', require('../middlewares/jd-upload.middleware'), controller.createPdfAnalysis);
router.get('/analyses/:analysisId', controller.getAnalysis);
router.get('/analyses/:analysisId/original', controller.downloadOriginal);
router.post('/analyses/:analysisId/requirements/extract', validate(require('zod').z.object({}).strict()), controller.extractRequirements);
router.post('/analyses/:analysisId/requirements/review', validate(require('zod').z.object({}).strict()), controller.reviewRequirements);
module.exports = router;
