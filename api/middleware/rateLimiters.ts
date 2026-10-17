import {rateLimit} from 'express-rate-limit';

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