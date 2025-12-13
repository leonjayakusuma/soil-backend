import express from 'express';
import { getUsers, getUserById, createUser } from '../controllers/userController.js';

const router = express.Router();

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUserById);

export default router;
