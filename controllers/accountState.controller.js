import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import { syncAccountStateSchema } from '../validators/accountState.validator.js';
import * as accountStateService from '../services/accountState.service.js';

export const get = catchAsync(async (req, res) => {
  const state = await accountStateService.getAccountState(req.user);
  sendResponse(res, { message: 'Account state', data: state });
});

export const sync = catchAsync(async (req, res) => {
  const { sections } = syncAccountStateSchema.parse(req.body);
  const state = await accountStateService.syncAccountState(req.user, sections);
  sendResponse(res, { message: 'Account state synced', data: state });
});

export default { get, sync };
