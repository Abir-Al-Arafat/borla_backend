import { Router } from 'express';
import multer from 'multer';
import parseData from '../../middleware/parseData';
import { zoneControllers } from './zone.controller';
import validateRequest from 'app/middleware/validateRequest';
import { zoneValidations } from './zone.validation';
import auth from 'app/middleware/auth';

const router = Router();
const upload = multer();

router.post(
  '/',
  upload.none(),
  auth('admin', 'supper_admin'),
  parseData(),
  validateRequest(zoneValidations.createZoneZodSchema),
  zoneControllers.createZone,
);

router.get(
  '/',
  auth('admin', 'supper_admin', 'rider'),
  zoneControllers.getAllZones,
);

router.get(
  '/:id',
  auth('admin', 'supper_admin', 'rider'),
  zoneControllers.getZoneById,
);

router.patch(
  '/:id',
  upload.none(),
  auth('admin', 'supper_admin'),
  parseData(),
  validateRequest(zoneValidations.updateZoneZodSchema),
  zoneControllers.updateZone,
);

router.delete(
  '/:id',
  auth('admin', 'supper_admin'),
  zoneControllers.deleteZone,
);

export const zoneRoutes = router;
