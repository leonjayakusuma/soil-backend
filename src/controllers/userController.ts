import { type Request, type Response } from "express";
import { type User } from "../models/user.js";


let users: User[] = []
let nextId = 1

export const getUsers = async (_req: Request, res: Response) => {
  try {
    return res.json({ 
      success: true,
      message: 'Users fetched successfully',
      data: users
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID',
    });
  }

  const userId = parseInt(id);
  const user = users.find(user => user.id === userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  
  return res.json({ 
    success: true,
    message: 'User fetched successfully',
    data: user
  });
}

export const createUser = async (req: Request, res: Response) => {
  const name = req.body?.name || req.query?.name;
  const email = req.body?.email || req.query?.email;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required',
    });
  }

  // Email validation using regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
    });
  }

  // Check if email already exists
  if (users.some(u => u.email === email)) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists',
    });
  }

  // Create user with auto-incrementing ID
  const newUser: User = {
    id: nextId++,
    name: name,
    email: email,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  return res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: newUser
  });
}
