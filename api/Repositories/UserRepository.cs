using api.Models;
using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace api.Repositories
{
    public class UserRepository:IUserRepository
    {
        private readonly string _connectionString;




        public UserRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("Default")!;
        }



        public async Task<User?> GetByEmailAsync(string email)
        {
            using (IDbConnection db = new SqlConnection(_connectionString))
            {

                string sql = "select * from users where email=@Email";

                return await db.QueryFirstOrDefaultAsync<User>(sql,new { Email =email });

            }


        }

        public async Task<int> CreateAsync(User user)
        {
            using (IDbConnection db = new SqlConnection(_connectionString))
            {
                string sql = @"INSERT INTO Users (Email, PasswordHash, DisplayName)
                       OUTPUT INSERTED.Id
                       VALUES (@Email, @PasswordHash, @DisplayName)";

                return await db.ExecuteScalarAsync<int>(sql, user);
            }
        }





    }










}

