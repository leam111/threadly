use Threadly;
create table Users(
Id int primary key identity(1,1),
Email nvarchar(100) not null unique , 
PasswordHash nvarchar(100) not null , 
DisplayName nvarchar(100) not null ,
IsActive bit not null default 1 , 
CreatedAt Datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);