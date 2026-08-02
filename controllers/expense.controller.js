import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import { syncExpensesSchema } from '../validators/expense.validator.js';
import * as expenseService from '../services/expense.service.js';

export const sync = catchAsync(async (req, res) => {
  const { expenses } = syncExpensesSchema.parse(req.body);
  const result = await expenseService.syncExpenses(req.user, expenses);

  sendResponse(res, {
    message: 'Expenses synced',
    data: result,
  });
});

export default { sync };
