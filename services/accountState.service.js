import { AccountState, User } from '../models/index.js';

const serialize = (document) => {
  const sections = {};

  for (const [name, section] of Object.entries(document?.sections ?? {})) {
    if (!section || section.value === undefined) continue;
    sections[name] = {
      value: section.value,
      revision: section.revision ?? 0,
      updatedAt: section.updatedAt?.toISOString?.() ?? String(section.updatedAt),
    };
  }

  return { sections };
};

export const getAccountState = async (user) => {
  const document = await AccountState.findOne({ user: user._id }).lean();
  return serialize(document);
};

const updateUserProfile = async (user, profile) => {
  if (!profile) return;

  const set = {
    displayName: profile.displayName,
    currency: profile.currency,
    appearance: profile.appearance,
    'onboarding.completed': profile.onboardingCompleted,
  };

  if (profile.onboardingCompleted && !user.onboarding?.completedAt) {
    set['onboarding.completedAt'] = new Date();
  }

  await User.updateOne({ _id: user._id }, { $set: set });
};

export const syncAccountState = async (user, sections) => {
  const now = new Date();
  const set = {};
  const increment = {};

  for (const [name, value] of Object.entries(sections)) {
    set[`sections.${name}.value`] = value;
    set[`sections.${name}.updatedAt`] = now;
    increment[`sections.${name}.revision`] = 1;
  }

  const update = {
    $set: set,
    $inc: increment,
    $setOnInsert: { user: user._id },
  };

  let document;
  try {
    document = await AccountState.findOneAndUpdate({ user: user._id }, update, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }).lean();
  } catch (error) {
    // Two first writes from two devices can race the unique user index. The
    // loser retries as a normal update; each section update remains atomic.
    if (error?.code !== 11000) throw error;
    document = await AccountState.findOneAndUpdate({ user: user._id }, update, {
      new: true,
      runValidators: true,
    }).lean();
  }

  await updateUserProfile(user, sections.profile);
  return serialize(document);
};

export default { getAccountState, syncAccountState };
