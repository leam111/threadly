using api.Models;
using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;


namespace api.Repositories
{
    public class WardrobeItemRepository:IWardrobeItemRepository
    {

        private readonly string _connectionString;
        

        public WardrobeItemRepository(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("Default")!;
        }



        public async Task<IEnumerable<WardrobeItem>> GetAllAsync()
        {

            using (IDbConnection db = new SqlConnection(_connectionString))
            {
                string sql = "SELECT Id, Name, Brand, Size, WearCount, Status, IsDeleted FROM WardrobeItems WHERE IsDeleted = 0";

                return await db.QueryAsync<WardrobeItem>(sql);
            }




        }







    }
}
