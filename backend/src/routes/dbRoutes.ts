import { Router } from 'express';
import * as dbController from '../controllers/dbController';

const router = Router();

router.post('/connect', dbController.connect);
router.get('/databases', dbController.getDatabases);
router.get('/objects', dbController.getObjects);
router.get('/object-counts', dbController.getObjectCounts);
router.get('/modified-objects', dbController.getModifiedObjects);
router.get('/script', dbController.getScript);
router.get('/search-scripts', dbController.searchScripts);
router.post('/query', dbController.executeQuery);
router.post('/disconnect', dbController.disconnect);

export default router;
