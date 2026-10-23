import {rateLimit, MemoryStore} from 'express-rate-limit';

export const loginLimiter = rateLimit({

windowMs : 60 * 1000,
limit : 6,
standardHeaders:"draft-7",
legacyHeaders:false,
message:{message:"too many login attempts , please try again after a minute"
}

});


export const registerLimiter = rateLimit({

windowMs:3600000,//1 hour
limit :5,
standardHeaders:"draft-7",
legacyHeaders:false,
message:{message:"too many register attempts , please try again after a while"}
});

export const RefreshLimiter = rateLimit({

windowMs : 60 * 1000,
limit : 10,
standardHeaders:"draft-7",
legacyHeaders:false,
message:{message:"too many refresh attempts , please try again after a minute"
}

});

// each sensitive limiter has its own store, so tests can empty them
const changePasswordStore = new MemoryStore();
const deactivateStore = new MemoryStore();
const logoutOthersStore = new MemoryStore();
const writeStore = new MemoryStore();

export const changePasswordLimiter = rateLimit({

windowMs : 15 * 60 * 1000,//15 minutes
limit : 5,
standardHeaders:"draft-7",
legacyHeaders:false,
store:changePasswordStore,
message:{message:"too many change password attempts , please try again after 15 minutes"
}

});

export const deactivateLimiter = rateLimit({

windowMs : 15 * 60 * 1000,//15 minutes
limit : 5,
standardHeaders:"draft-7",
legacyHeaders:false,
store:deactivateStore,
message:{message:"too many deactivate attempts , please try again after 15 minutes"
}

});

export const logoutOthersLimiter = rateLimit({

windowMs : 15 * 60 * 1000,//15 minutes
limit : 5,
standardHeaders:"draft-7",
legacyHeaders:false,
store:logoutOthersStore,
message:{message:"too many logout attempts , please try again after 15 minutes"
}

});

// ONE limiter shared by the wardrobe and profile write routes:
// 60 changes per 15 minutes per IP, counted together for all of them
export const writeLimiter = rateLimit({

windowMs : 15 * 60 * 1000,//15 minutes
limit : 60,
standardHeaders:"draft-7",
legacyHeaders:false,
store:writeStore,
message:{message:"too many changes , please try again after 15 minutes"
}

});

// for tests: start every sensitive limiter again from 0
export async function resetSensitiveLimiters() {
  await changePasswordStore.resetAll();
  await deactivateStore.resetAll();
  await logoutOthersStore.resetAll();
  await writeStore.resetAll();
}
