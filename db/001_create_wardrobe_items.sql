use WardrobeItems;

create table Users(

Id int Primary Key Identity (1,1),
Email nvarchar(100) not null unique ,
PasswordHash nvarchar(100) not null ,
DisplayName nvarchar(100) not null , 
IsActive Bit not null default 1,
CreatedAt datetime2 not null default SYSUTCDATETIME()

);