use WardrobeItems;

CREATE TABLE WardrobeItems (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100),
    Brand NVARCHAR(100),
    Size NVARCHAR(100),
    WearCount INT,
    Status NVARCHAR(20) NOT NULL DEFAULT 'In Closet',
    IsDeleted BIT NOT NULL DEFAULT 0
);